//! Every route of the API together with its OpenAPI description, assembled in
//! one place so the two cannot drift apart. The description is committed as
//! `openapi.json` and the client's types are generated from it.

use crate::{
    access_control, announcements, assets, auth,
    common::{csrf::csrf_middleware, extractors::resolve_tenant, rate_limit},
    data_export,
    error::ErrorBody,
    group, items, mfa, oauth, passkeys, realtime, reauth, schedule,
    state::AppState,
    super_admin, system, system_announcements, todos, user,
};
use axum::{Router, extract::DefaultBodyLimit, http::StatusCode, middleware};
use std::time::Duration;
use tower_http::timeout::TimeoutLayer;
use utoipa::{
    OpenApi,
    openapi::{
        self, Ref, RefOr,
        path::{Operation, Parameter, ParameterIn, PathItem},
        response::Response,
    },
};
use utoipa_axum::router::OpenApiRouter;

/// Every JSON request fits easily; the few routes that take more (uploads, the
/// timetable) raise the limit for themselves. Axum's own default of 2 MB would
/// let any request carry far more than the server ever needs to read.
const DEFAULT_BODY_LIMIT_BYTES: usize = 64 * 1024;

const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

/// The timeout covers reading the request body, and a file at the upload
/// limit takes minutes over a weak school or mobile connection.
const UPLOAD_TIMEOUT: Duration = Duration::from_secs(5 * 60);

const GROUP_PREFIX: &str = "/groups/{group_id}";

#[derive(OpenApi)]
#[openapi(info(title = "Olauda API"), components(schemas(ErrorBody)))]
struct ApiDoc;

/// The API's routes and their description. Error responses and the group of
/// group-scoped routes are documented here once instead of on every handler.
pub fn router(state: &AppState) -> (Router<AppState>, openapi::OpenApi) {
    // Every group-bound endpoint names its group in the path. The layer checks
    // membership once per request, so no handler below can be reached for a
    // group the caller does not belong to.
    let group_scoped = OpenApiRouter::new()
        .merge(announcements::routes::group_router())
        .merge(group::routes::group_router())
        .merge(items::routes::group_router())
        .merge(schedule::routes::group_router())
        .merge(user::routes::group_router())
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            resolve_tenant,
        ));

    let group_uploads = assets::routes::group_router().route_layer(middleware::from_fn_with_state(
        state.clone(),
        resolve_tenant,
    ));

    let uploads = OpenApiRouter::new()
        .nest(GROUP_PREFIX, group_uploads)
        .merge(assets::routes::router())
        .route_layer(TimeoutLayer::with_status_code(
            StatusCode::REQUEST_TIMEOUT,
            UPLOAD_TIMEOUT,
        ));

    let (router, mut doc) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        .nest(GROUP_PREFIX, group_scoped)
        .merge(system::routes::router())
        .merge(access_control::routes::router())
        .merge(system_announcements::routes::router())
        .merge(auth::routes::router())
        .merge(user::routes::router())
        .merge(data_export::routes::router())
        .merge(group::routes::router())
        .merge(todos::routes::router())
        .merge(mfa::routes::router())
        .merge(oauth::routes::router())
        .merge(passkeys::routes::router())
        .merge(reauth::routes::router())
        .merge(super_admin::routes::router(state.clone()))
        .route_layer(TimeoutLayer::with_status_code(
            StatusCode::REQUEST_TIMEOUT,
            REQUEST_TIMEOUT,
        ))
        .merge(uploads)
        .merge(realtime::routes::router())
        .layer(DefaultBodyLimit::max(DEFAULT_BODY_LIMIT_BYTES))
        .layer(rate_limit::global())
        .layer(middleware::from_fn_with_state(
            state.clone(),
            csrf_middleware,
        ))
        .split_for_parts();

    document_conventions(&mut doc);
    (router, doc)
}

/// Adds what holds for every route, so no handler has to repeat it: group
/// routes take their group's id, and every failure answers with an
/// [`ErrorBody`].
fn document_conventions(doc: &mut openapi::OpenApi) {
    let error = RefOr::Ref(Ref::from_schema_name("ErrorBody"));
    let error_response: RefOr<Response> = Response::builder()
        .description("The request failed")
        .content(
            "application/json",
            openapi::Content::builder().schema(Some(error)).build(),
        )
        .build()
        .into();

    doc.info.description = Some("The API of the Olauda web app.".to_owned());
    doc.info.license = None;

    for (path, item) in &mut doc.paths.paths {
        if path.starts_with(GROUP_PREFIX) {
            item.parameters = Some(vec![RefOr::T(group_id_parameter())]);
        }
        for operation in operations_mut(item) {
            let responses = &mut operation.responses.responses;
            for (status, response) in responses.iter_mut() {
                if let RefOr::T(response) = response
                    && response.description.is_empty()
                {
                    response.description = reason_phrase(status);
                }
            }
            responses
                .entry("default".to_owned())
                .or_insert_with(|| error_response.clone());
        }
    }
}

/// OpenAPI requires every response to be described; a plain success needs
/// nothing beyond its status.
fn reason_phrase(status: &str) -> String {
    status
        .parse()
        .ok()
        .and_then(|code| StatusCode::from_u16(code).ok())
        .and_then(|code| code.canonical_reason())
        .unwrap_or("Success")
        .to_owned()
}

fn group_id_parameter() -> Parameter {
    Parameter::builder()
        .name("group_id")
        .parameter_in(ParameterIn::Path)
        .required(openapi::Required::True)
        .schema(Some(
            openapi::ObjectBuilder::new()
                .schema_type(openapi::schema::Type::String)
                .format(Some(openapi::SchemaFormat::KnownFormat(
                    openapi::KnownFormat::Uuid,
                ))),
        ))
        .build()
}

fn operations_mut(item: &mut PathItem) -> impl Iterator<Item = &mut Operation> {
    [
        &mut item.get,
        &mut item.put,
        &mut item.post,
        &mut item.delete,
        &mut item.options,
        &mut item.head,
        &mut item.patch,
        &mut item.trace,
        &mut item.query,
    ]
    .into_iter()
    .flatten()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{collections::HashSet, path::Path};

    /// The committed description the client is generated from. Run
    /// `UPDATE_OPENAPI=1 cargo test` after changing the API to rewrite it.
    #[tokio::test]
    async fn committed_description_matches_the_routes() {
        let (_, doc) = router(&AppState::for_tests());
        let generated = doc.to_pretty_json().expect("serializable description") + "\n";
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("openapi.json");

        if std::env::var_os("UPDATE_OPENAPI").is_some() {
            std::fs::write(&path, generated).expect("writable openapi.json");
            return;
        }

        let committed = std::fs::read_to_string(&path).unwrap_or_default();
        assert!(
            committed == generated,
            "openapi.json is outdated; run `UPDATE_OPENAPI=1 cargo test` and regenerate the client"
        );
    }

    #[tokio::test]
    async fn every_operation_has_its_own_id() {
        let (_, mut doc) = router(&AppState::for_tests());
        let mut seen = HashSet::new();

        for (path, item) in &mut doc.paths.paths {
            for operation in operations_mut(item) {
                let id = operation.operation_id.clone().unwrap_or_default();
                assert!(
                    seen.insert(id.clone()),
                    "{id} is used twice, again at {path}"
                );
            }
        }
    }

    #[tokio::test]
    async fn every_reference_resolves() {
        let (_, doc) = router(&AppState::for_tests());
        let json = serde_json::to_value(&doc).expect("serializable description");
        let schemas = &json["components"]["schemas"];

        let mut references = Vec::new();
        collect_references(&json, &mut references);
        for reference in references {
            let name = reference.trim_start_matches("#/components/schemas/");
            assert!(schemas.get(name).is_some(), "{reference} is not defined");
        }
    }

    fn collect_references(value: &serde_json::Value, found: &mut Vec<String>) {
        match value {
            serde_json::Value::Object(map) => {
                if let Some(serde_json::Value::String(reference)) = map.get("$ref") {
                    found.push(reference.clone());
                }
                map.values().for_each(|v| collect_references(v, found));
            }
            serde_json::Value::Array(items) => {
                items.iter().for_each(|v| collect_references(v, found));
            }
            _ => {}
        }
    }

    #[tokio::test]
    async fn group_routes_take_the_group_id() {
        let (_, doc) = router(&AppState::for_tests());
        let group_routes: Vec<_> = doc
            .paths
            .paths
            .iter()
            .filter(|(path, _)| path.starts_with(GROUP_PREFIX))
            .collect();

        assert!(!group_routes.is_empty());
        for (path, item) in group_routes {
            assert!(item.parameters.is_some(), "{path} lacks group_id");
        }
    }
}
