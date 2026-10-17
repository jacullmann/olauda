//! The ways an account can sign in. No change may take away the last one: a
//! password reset by email would still get the owner back in, but only as a
//! detour they never asked for.

use crate::error::{AppError, AppResult, AuthFailure};
use serde::Serialize;
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SignInMethod {
    Password,
    Passkey,
    Google,
}

impl SignInMethod {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Password => "password",
            Self::Passkey => "passkey",
            Self::Google => "google",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, utoipa::ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SignInMethods {
    pub password: bool,
    pub passkeys: usize,
    pub google: bool,
    /// Not a way to sign in, but what each of them asks for in addition.
    pub two_factor: bool,
}

impl SignInMethods {
    pub async fn load(db: &PgPool, user_id: Uuid) -> AppResult<Self> {
        let row = sqlx::query!(
            r#"SELECT password_hash IS NOT NULL AS "password!",
                      mfa_enabled AND mfa_secret IS NOT NULL AS "two_factor!",
                      (SELECT count(*) FROM passkeys WHERE user_id = u.id) AS "passkeys!",
                      EXISTS (
                          SELECT 1 FROM oauth_accounts
                          WHERE user_id = u.id AND provider = 'google'
                      ) AS "google!"
               FROM users u
               WHERE id = $1"#,
            user_id
        )
        .fetch_optional(db)
        .await?
        .ok_or_else(|| AppError::not_found("User not found."))?;

        Ok(Self {
            password: row.password,
            passkeys: usize::try_from(row.passkeys).unwrap_or(usize::MAX),
            google: row.google,
            two_factor: row.two_factor,
        })
    }

    /// Reads the methods and locks the account until the transaction ends, so
    /// two concurrent removals cannot each see the other's method left over.
    pub async fn lock(conn: &mut PgConnection, user_id: Uuid) -> AppResult<Self> {
        let row = sqlx::query!(
            r#"SELECT password_hash IS NOT NULL AS "password!",
                      mfa_enabled AND mfa_secret IS NOT NULL AS "two_factor!"
               FROM users
               WHERE id = $1
               FOR UPDATE"#,
            user_id
        )
        .fetch_optional(&mut *conn)
        .await?
        .ok_or_else(|| AppError::not_found("User not found."))?;

        let linked = sqlx::query!(
            r#"SELECT (SELECT count(*) FROM passkeys WHERE user_id = $1) AS "passkeys!",
                      EXISTS (
                          SELECT 1 FROM oauth_accounts
                          WHERE user_id = $1 AND provider = 'google'
                      ) AS "google!""#,
            user_id
        )
        .fetch_one(&mut *conn)
        .await?;

        Ok(Self {
            password: row.password,
            passkeys: usize::try_from(linked.passkeys).unwrap_or(usize::MAX),
            google: linked.google,
            two_factor: row.two_factor,
        })
    }

    fn count(&self) -> usize {
        usize::from(self.password) + self.passkeys + usize::from(self.google)
    }

    /// Fails unless the account keeps a way to sign in once one `method` is
    /// gone.
    pub fn ensure_one_left_without(&self, method: SignInMethod) -> AppResult<()> {
        let removed = usize::from(match method {
            SignInMethod::Password => self.password,
            SignInMethod::Passkey => self.passkeys > 0,
            SignInMethod::Google => self.google,
        });

        if self.count() > removed {
            Ok(())
        } else {
            Err(AuthFailure::LastSignInMethod.into())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn methods(password: bool, passkeys: usize, google: bool) -> SignInMethods {
        SignInMethods {
            password,
            passkeys,
            google,
            two_factor: false,
        }
    }

    #[test]
    fn the_only_method_cannot_be_removed() {
        assert!(
            methods(true, 0, false)
                .ensure_one_left_without(SignInMethod::Password)
                .is_err()
        );
        assert!(
            methods(false, 1, false)
                .ensure_one_left_without(SignInMethod::Passkey)
                .is_err()
        );
        assert!(
            methods(false, 0, true)
                .ensure_one_left_without(SignInMethod::Google)
                .is_err()
        );
    }

    #[test]
    fn a_method_can_go_while_another_remains() {
        assert!(
            methods(true, 1, false)
                .ensure_one_left_without(SignInMethod::Password)
                .is_ok()
        );
        assert!(
            methods(false, 2, false)
                .ensure_one_left_without(SignInMethod::Passkey)
                .is_ok()
        );
        assert!(
            methods(true, 0, true)
                .ensure_one_left_without(SignInMethod::Google)
                .is_ok()
        );
    }
}
