mod access_control;
mod announcements;
mod assets;
mod auth;
mod common;
mod config;
mod data_export;
mod error;
mod group;
mod items;
mod messages;
mod mfa;
mod oauth;
mod passkeys;
mod reauth;
mod reports;
mod schedule;
mod security_log;
mod state;
mod super_admin;
mod system;
mod system_announcements;
mod todos;
mod user;

use anyhow::Context;
use axum::{Router, extract::DefaultBodyLimit, middleware};
use common::{csrf::csrf_middleware, extractors::resolve_tenant};
use config::Config;
use sqlx::postgres::PgPoolOptions;
use state::AppState;
use std::time::Duration;
use tower_http::{
    compression::CompressionLayer,
    cors::{AllowHeaders, AllowMethods, CorsLayer},
    request_id::{MakeRequestUuid, SetRequestIdLayer},
    trace::TraceLayer,
};
use tracing::info;
use tracing_subscriber::{EnvFilter, layer::SubscriberExt, util::SubscriberInitExt};

/// Every JSON request fits easily; the few routes that take more (uploads, the
/// timetable) raise the limit for themselves. Axum's own default of 2 MB would
/// let any request carry far more than the server ever needs to read.
const DEFAULT_BODY_LIMIT_BYTES: usize = 64 * 1024;

const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

/// The timeout covers reading the request body, and a file at the upload
/// limit takes minutes over a weak school or mobile connection.
const UPLOAD_TIMEOUT: Duration = Duration::from_secs(5 * 60);

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,server=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    let config = Config::from_env().context("Failed to load configuration")?;

    let port = config.port;

    let cors_origin = config.cors_origin.clone();

    let db = PgPoolOptions::new()
        .max_connections(20)
        .connect(&config.database_url)
        .await
        .context("Failed to connect to database")?;

    sqlx::migrate!("./migrations")
        .run(&db)
        .await
        .context("Failed to run migrations")?;

    info!("Database connected and migrations applied.");

    let state = AppState::new(db, config)?;

    assets::sweep::spawn(state.db.clone(), state.cloudinary.clone());

    let cors = CorsLayer::new()
        .allow_origin(
            cors_origin
                .parse::<axum::http::HeaderValue>()
                .context("Invalid CORS_ORIGIN")?,
        )
        .allow_credentials(true)
        .allow_methods(AllowMethods::list([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::PATCH,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ]))
        .allow_headers(AllowHeaders::list([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::HeaderName::from_static("x-csrf-token"),
        ]))
        .expose_headers([common::personalization::HIDDEN_BY_COURSES]);

    // Every group-bound endpoint names its group in the path. The layer checks
    // membership once per request, so no handler below can be reached for a
    // group the caller does not belong to.
    let group_scoped = Router::new()
        .merge(announcements::routes::group_router())
        .merge(group::routes::group_router())
        .merge(items::routes::group_router())
        .merge(messages::routes::group_router())
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

    #[allow(deprecated)]
    let uploads = Router::new()
        .nest("/groups/{group_id}", group_uploads)
        .merge(assets::routes::router())
        .route_layer(tower_http::timeout::TimeoutLayer::new(UPLOAD_TIMEOUT));

    #[allow(deprecated)]
    let api = Router::new()
        .nest("/groups/{group_id}", group_scoped)
        .merge(system::routes::router())
        .merge(access_control::routes::router())
        .merge(system_announcements::routes::router())
        .merge(auth::routes::router())
        .merge(user::routes::router())
        .merge(data_export::routes::router())
        .merge(group::routes::router())
        .merge(todos::routes::router())
        .merge(messages::routes::router())
        .merge(mfa::routes::router())
        .merge(oauth::routes::router())
        .merge(passkeys::routes::router())
        .merge(reauth::routes::router())
        .merge(super_admin::routes::router(state.clone()))
        .route_layer(tower_http::timeout::TimeoutLayer::new(REQUEST_TIMEOUT))
        .merge(uploads)
        .layer(DefaultBodyLimit::max(DEFAULT_BODY_LIMIT_BYTES))
        .layer(common::rate_limit::global())
        .layer(middleware::from_fn_with_state(
            state.clone(),
            csrf_middleware,
        ))
        .with_state(state);

    let app = Router::new()
        .merge(api)
        .layer(cors)
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http())
        .layer(SetRequestIdLayer::x_request_id(MakeRequestUuid));

    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .context("Failed to bind TCP listener")?;

    info!("Server listening on {addr}");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("Server error")?;

    Ok(())
}

/// Every deploy replaces the container with SIGTERM. Requests in flight must
/// still finish: a refresh cut off after its rotation commits leaves the
/// browser holding a spent token, and replaying that later revokes the whole
/// session as theft.
async fn shutdown_signal() {
    let ctrl_c = async {
        if tokio::signal::ctrl_c().await.is_err() {
            std::future::pending::<()>().await;
        }
    };

    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut sigterm) => {
                sigterm.recv().await;
            }
            Err(_) => std::future::pending::<()>().await,
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => {},
        () = terminate => {},
    }

    info!("Shutting down after in-flight requests finish");
}
