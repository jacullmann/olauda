use crate::{
    auth::session_context::{SessionStatus, is_superadmin, session_status},
    common::{
        jwt::JwtService,
        path_params::GroupPath,
        permission::{GroupPermissions, Permission},
        role::Role,
    },
    config::{ACCESS_COOKIE, REAUTH_WINDOW, chrono_ttl},
    error::{AppError, AppResult},
    state::AppState,
};
use axum::{
    Json,
    extract::{
        FromRef, FromRequest, FromRequestParts, Path, Request, State,
        rejection::{JsonRejection, PathRejection},
    },
    http::request::Parts,
    middleware::Next,
    response::Response,
};
use axum_extra::extract::CookieJar;
use chrono::{DateTime, Utc};
use serde::de::DeserializeOwned;
use sqlx::PgPool;
use uuid::Uuid;
use validator::Validate;

/// Who is calling, as proven by the access token. It carries no roles: every
/// authorization decision reads the current state from the database, so a
/// revoked right never outlives the request that revoked it.
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: Uuid,
    pub email: String,
    /// The session (refresh token family) the request was made in.
    pub session_id: Uuid,
    /// When the user last proved who they are in this session.
    pub authenticated_at: DateTime<Utc>,
}

impl AuthUser {
    /// The identity the access token vouches for, before the account and
    /// session behind it are confirmed active.
    pub fn from_access_token(jar: &CookieJar, jwt: &JwtService) -> AppResult<Self> {
        let token = jar.get(ACCESS_COOKIE).ok_or(AppError::AuthRequired)?;
        let claims = jwt.verify_access(token.value())?;

        Ok(AuthUser {
            user_id: claims.sub,
            authenticated_at: claims.authenticated_at(),
            email: claims.email,
            session_id: claims.sid,
        })
    }
}

impl<S> FromRequestParts<S> for AuthUser
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let app_state = AppState::from_ref(state);

        let jar = CookieJar::from_request_parts(parts, state)
            .await
            .map_err(|_| AppError::AuthRequired)?;

        let user = Self::from_access_token(&jar, &app_state.jwt)?;

        // A 401 sends the client to refresh, which the ended session fails, so
        // a banned or deleted user, or one whose session ended, is signed out
        // on their next request.
        session_status(&app_state.db, user.user_id, user.session_id)
            .await?
            .ensure_active()?;

        Ok(user)
    }
}

/// A caller who proved who they are within the last [`REAUTH_WINDOW`], as a
/// sensitive action requires. Signing in counts, so an action taken right
/// after signing in needs no extra step.
#[derive(Debug, Clone)]
pub struct RecentAuth(pub AuthUser);

impl<S> FromRequestParts<S> for RecentAuth
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let user = AuthUser::from_request_parts(parts, state).await?;

        if Utc::now() - user.authenticated_at > chrono_ttl(REAUTH_WINDOW) {
            return Err(AppError::ReauthRequired);
        }

        Ok(Self(user))
    }
}

#[derive(Debug, Clone)]
pub struct OptionalAuth(pub Option<AuthUser>);

impl<S> FromRequestParts<S> for OptionalAuth
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        match AuthUser::from_request_parts(parts, state).await {
            Ok(user) => Ok(OptionalAuth(Some(user))),
            Err(AppError::AuthRequired | AppError::TokenExpired) => Ok(OptionalAuth(None)),
            Err(e) => Err(e),
        }
    }
}

#[derive(Debug, Clone)]
pub struct MfaPending {
    pub user_id: Uuid,
    pub email: String,
    pub expires_at: DateTime<Utc>,
}

impl<S> FromRequestParts<S> for MfaPending
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        use crate::config::MFA_PENDING_COOKIE;

        let app_state = AppState::from_ref(state);

        let jar = CookieJar::from_request_parts(parts, state)
            .await
            .map_err(|_| AppError::MfaChallengeExpired)?;

        let token = jar
            .get(MFA_PENDING_COOKIE)
            .map(|c| c.value().to_owned())
            .ok_or(AppError::MfaChallengeExpired)?;

        let claims = app_state.jwt.verify_mfa_pending(&token)?;

        if claims.purpose != "mfa_pending" {
            return Err(AppError::MfaChallengeExpired);
        }

        let user_id = claims
            .sub
            .parse::<Uuid>()
            .map_err(|_| AppError::MfaChallengeExpired)?;

        let expires_at = i64::try_from(claims.exp)
            .ok()
            .and_then(|exp| DateTime::from_timestamp(exp, 0))
            .ok_or(AppError::MfaChallengeExpired)?;

        Ok(MfaPending {
            user_id,
            email: claims.email,
            expires_at,
        })
    }
}

/// The caller's standing in the group named by the request path. The tenant
/// middleware resolves it once for every route nested under
/// `/groups/{group_id}`, so a handler can only be reached by a member (or a
/// superadmin) and never has to repeat the check.
#[derive(Debug, Clone)]
pub struct TenantContext {
    pub tenant_id: Uuid,
    pub tenant_role: Role,
    pub group_owner_id: Uuid,
    pub group_permissions: GroupPermissions,
    /// Read from the database, not the access token, so a revoked superadmin
    /// loses group access immediately instead of when the token expires.
    pub is_superadmin: bool,
    pub user: AuthUser,
}

impl TenantContext {
    pub async fn resolve(db: &PgPool, user: AuthUser, tenant_id: Uuid) -> AppResult<Self> {
        // One round trip for everything a group request needs to authorize.
        let row = sqlx::query!(
            r#"
            SELECT g.owner_id,
                   g.permissions,
                   g.banned_at IS NOT NULL AS "banned!",
                   (SELECT r.name FROM user_roles ur
                    JOIN roles r ON r.id = ur.role_id
                    WHERE ur.user_id = $1 AND ur.tenant_id = g.id) AS "tenant_role?",
                   EXISTS (
                       SELECT 1 FROM user_roles
                       WHERE user_id = $1 AND tenant_id IS NULL AND role_id = $3
                   ) AS "is_superadmin!",
                   EXISTS (
                       SELECT 1 FROM users u
                       WHERE u.id = $1
                         AND NOT EXISTS (SELECT 1 FROM banned_users b WHERE b.user_id = u.id)
                         AND EXISTS (
                             SELECT 1 FROM refresh_tokens t
                             WHERE t.family_id = $4 AND t.user_id = u.id AND t.revoked_at IS NULL
                         )
                   ) AS "session_active!",
                   (SELECT shutdown FROM access_controls) AS "shutdown!"
            FROM groups g
            WHERE g.id = $2
            "#,
            user.user_id,
            tenant_id,
            Role::Superadmin.db_id_i32(),
            user.session_id
        )
        .fetch_optional(db)
        .await?;

        let row = row.ok_or_else(group_not_found)?;

        SessionStatus::of(row.session_active, row.shutdown && !row.is_superadmin)
            .ensure_active()?;

        let tenant_role = match (row.is_superadmin, row.tenant_role.as_deref()) {
            (true, _) => Role::Superadmin,
            (false, Some(role)) => Role::from_str_or_user(role),
            (false, None) => return Err(group_not_found()),
        };

        // Checked after membership, so non-members still cannot tell a banned
        // group from a missing one. Superadmins keep access to review it.
        if row.banned && !row.is_superadmin {
            return Err(AppError::GroupBanned {
                group_id: tenant_id,
            });
        }

        Ok(Self {
            tenant_id,
            tenant_role,
            group_owner_id: row.owner_id,
            group_permissions: GroupPermissions::from_json_with_defaults(&row.permissions),
            is_superadmin: row.is_superadmin,
            user,
        })
    }

    pub fn is_owner(&self) -> bool {
        self.group_owner_id == self.user.user_id
    }

    pub fn can(&self, permission: Permission) -> bool {
        if self.has_owner_rights() {
            return true;
        }
        let required = self.group_permissions.required_role(permission);
        self.tenant_role.dominates(required)
    }

    /// Superadmins act with the owner's rights in every group, whether or not
    /// they are a member of it.
    pub fn has_owner_rights(&self) -> bool {
        self.is_superadmin || self.is_owner()
    }

    pub fn effective_permission_keys(&self) -> Vec<&'static str> {
        self.group_permissions
            .effective_keys(self.tenant_role, self.has_owner_rights())
    }
}

/// Non-members get the same answer as for a missing or malformed group id, so
/// group ids cannot be probed for existence.
fn group_not_found() -> AppError {
    AppError::not_found("Group not found.")
}

/// Route layer for everything nested under `/groups/{group_id}`. It reads
/// the token without the [`AuthUser`] extractor because the tenant query
/// already confirms the account and session are active and that shutdown
/// admits the caller, saving a round trip per request.
pub async fn resolve_tenant(
    State(state): State<AppState>,
    jar: CookieJar,
    path: Result<Path<GroupPath>, PathRejection>,
    mut request: Request,
    next: Next,
) -> AppResult<Response> {
    let user = AuthUser::from_access_token(&jar, &state.jwt)?;
    let Path(GroupPath { group_id }) = path.map_err(|_| group_not_found())?;
    let tenant = TenantContext::resolve(&state.db, user, group_id).await?;
    request.extensions_mut().insert(tenant);
    Ok(next.run(request).await)
}

impl<S> FromRequestParts<S> for TenantContext
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        from_route_layer(parts, "resolve_tenant")
    }
}

/// A caller whose superadmin role was confirmed against the database for this
/// request by the `require_superadmin` route layer.
#[derive(Debug, Clone)]
pub struct SuperAdmin(pub AuthUser);

/// Route layer for the platform administration endpoints.
pub async fn require_superadmin(
    State(state): State<AppState>,
    user: AuthUser,
    mut request: Request,
    next: Next,
) -> AppResult<Response> {
    if !is_superadmin(&state.db, user.user_id).await? {
        return Err(AppError::forbidden("Super-admin privileges required."));
    }
    request.extensions_mut().insert(SuperAdmin(user));
    Ok(next.run(request).await)
}

impl<S> FromRequestParts<S> for SuperAdmin
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        from_route_layer(parts, "require_superadmin")
    }
}

/// Reading a guard's result without its layer is a routing bug, not a
/// client error, so it fails loudly.
fn from_route_layer<T: Clone + Send + Sync + 'static>(
    parts: &Parts,
    layer: &str,
) -> Result<T, AppError> {
    parts.extensions.get::<T>().cloned().ok_or_else(|| {
        AppError::internal(format!(
            "{} extracted on a route without the {layer} layer",
            std::any::type_name::<T>()
        ))
    })
}

/// `Json<T>` that runs the DTO's `validate()` before the handler sees it, so
/// handlers never carry validation boilerplate.
pub struct ValidatedJson<T>(pub T);

impl<T, S> FromRequest<S> for ValidatedJson<T>
where
    T: DeserializeOwned + Validate,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request(req: Request, state: &S) -> Result<Self, Self::Rejection> {
        let Json(value) = Json::<T>::from_request(req, state)
            .await
            .map_err(|e: JsonRejection| AppError::BadRequest(e.body_text()))?;

        value.validate().map_err(|e| {
            AppError::Validation(e.field_errors().keys().map(ToString::to_string).collect())
        })?;

        Ok(ValidatedJson(value))
    }
}
