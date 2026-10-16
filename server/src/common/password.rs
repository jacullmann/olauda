use crate::{common::memory_hard, error::AppError};
use argon2::{
    Argon2,
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString, rand_core::OsRng},
};

pub async fn hash_password(password: String) -> Result<String, AppError> {
    memory_hard::run(move || {
        let salt = SaltString::generate(&mut OsRng);

        let argon2 = Argon2::default();

        argon2
            .hash_password(password.as_bytes(), &salt)
            .map(|h| h.to_string())
            .map_err(|e| AppError::internal(format!("Password hashing failed: {e}")))
    })
    .await?
}

pub async fn verify_password(password: String, hash: String) -> Result<bool, AppError> {
    memory_hard::run(move || {
        let parsed = PasswordHash::new(&hash)
            .map_err(|e| AppError::internal(format!("Invalid password hash: {e}")))?;

        Ok(Argon2::default()
            .verify_password(password.as_bytes(), &parsed)
            .is_ok())
    })
    .await?
}

const MIN_PASSWORD_LENGTH: usize = 12;

/// Length only, no composition rules (NIST SP 800-63B). Applies to new
/// passwords; existing ones keep working at sign-in.
pub fn validate_password_strength(password: &str) -> Result<(), &'static str> {
    if password.chars().count() < MIN_PASSWORD_LENGTH {
        return Err("Password must be at least 12 characters long.");
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn requires_twelve_characters_of_any_kind() {
        assert!(validate_password_strength("abcdefghijk").is_err());
        assert!(validate_password_strength("abcdefghijkl").is_ok());
        assert!(validate_password_strength("äöüßäöüßäöüß").is_ok());
    }
}
