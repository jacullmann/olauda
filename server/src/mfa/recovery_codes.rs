//! One-time codes that stand in for the authenticator app when it is lost.
//!
//! A code carries 50 random bits, far too many to guess within the per-account
//! lock. Only a keyed hash is stored: HMAC-SHA256 with a server secret that
//! never reaches the database, so a leaked table cannot be brute-forced
//! offline, while checking a code stays a single indexed lookup.

use crate::error::AppResult;
use hmac::{Hmac, KeyInit, Mac};
use sha2::Sha256;
use sqlx::{PgConnection, PgExecutor};
use std::sync::Arc;
use uuid::Uuid;

pub const RECOVERY_CODE_COUNT: usize = 10;

/// Crockford's base32: no I, L, O or U, so a code survives being read aloud or
/// copied by hand. Its 32 symbols divide 256, so masking a random byte picks
/// each one with equal probability.
const ALPHABET: &[u8; 32] = b"0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const SYMBOLS_PER_CODE: usize = 10;
const GROUP_LEN: usize = 5;
/// Domain separation: the key is the account-key pepper, which also derives
/// encryption keys, so its use here must never produce the same output.
const HMAC_CONTEXT: &[u8] = b"olauda/mfa-recovery-code/v1\0";

/// Hashes recovery codes with the server secret.
#[derive(Clone)]
pub struct RecoveryCodeHasher(Arc<Hmac<Sha256>>);

impl RecoveryCodeHasher {
    pub fn new(secret: &str) -> Self {
        let mac = Hmac::<Sha256>::new_from_slice(secret.as_bytes())
            .expect("HMAC accepts keys of any length");
        Self(Arc::new(mac))
    }

    fn digest(&self, code: &NormalizedCode) -> Vec<u8> {
        let mut mac = (*self.0).clone();
        mac.update(HMAC_CONTEXT);
        mac.update(code.0.as_bytes());
        mac.finalize().into_bytes().to_vec()
    }
}

/// A code in canonical form: upper case, without separators, with the letters
/// Crockford's base32 reads as digits replaced by them.
#[derive(Debug, PartialEq, Eq)]
struct NormalizedCode(String);

impl NormalizedCode {
    fn parse(raw: &str) -> Option<Self> {
        let code: String = raw
            .chars()
            .filter(|c| !c.is_whitespace() && *c != '-')
            .map(|c| match c.to_ascii_uppercase() {
                'O' => '0',
                'I' | 'L' => '1',
                other => other,
            })
            .collect();

        let valid = code.len() == SYMBOLS_PER_CODE && code.bytes().all(|b| ALPHABET.contains(&b));
        valid.then_some(Self(code))
    }

    fn generate() -> Self {
        let code = rand::random::<[u8; SYMBOLS_PER_CODE]>()
            .iter()
            .map(|byte| char::from(ALPHABET[usize::from(byte & 0x1f)]))
            .collect();
        Self(code)
    }

    /// The form shown to the user, in two groups of five.
    fn display(&self) -> String {
        let (first, second) = self.0.split_at(GROUP_LEN);
        format!("{first}-{second}")
    }
}

/// Replaces the user's recovery codes with a fresh set and returns it for
/// display. Only the hashes are stored, so this is the one time the codes can
/// be shown.
pub async fn replace(
    conn: &mut PgConnection,
    hasher: &RecoveryCodeHasher,
    user_id: Uuid,
) -> AppResult<Vec<String>> {
    let codes: Vec<NormalizedCode> = std::iter::repeat_with(NormalizedCode::generate)
        .take(RECOVERY_CODE_COUNT)
        .collect();
    let hashes: Vec<Vec<u8>> = codes.iter().map(|code| hasher.digest(code)).collect();

    delete_all(&mut *conn, user_id).await?;

    sqlx::query!(
        r#"INSERT INTO mfa_recovery_codes (user_id, code_hash)
           SELECT $1, hash FROM unnest($2::bytea[]) AS hash"#,
        user_id,
        &hashes
    )
    .execute(&mut *conn)
    .await?;

    Ok(codes.iter().map(NormalizedCode::display).collect())
}

/// Uses up `raw` if it is one of the user's unused codes and returns how many
/// remain; `None` when it is not.
pub async fn redeem(
    conn: &mut PgConnection,
    hasher: &RecoveryCodeHasher,
    user_id: Uuid,
    raw: &str,
) -> AppResult<Option<usize>> {
    let Some(code) = NormalizedCode::parse(raw) else {
        return Ok(None);
    };

    let redeemed = sqlx::query!(
        r#"UPDATE mfa_recovery_codes SET used_at = now()
           WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL
           RETURNING id"#,
        user_id,
        hasher.digest(&code)
    )
    .fetch_optional(&mut *conn)
    .await?;

    match redeemed {
        Some(_) => Ok(Some(remaining(&mut *conn, user_id).await?)),
        None => Ok(None),
    }
}

pub async fn remaining<'e>(db: impl PgExecutor<'e>, user_id: Uuid) -> AppResult<usize> {
    let count = sqlx::query_scalar!(
        r#"SELECT count(*) AS "count!" FROM mfa_recovery_codes
           WHERE user_id = $1 AND used_at IS NULL"#,
        user_id
    )
    .fetch_one(db)
    .await?;

    Ok(usize::try_from(count).unwrap_or_default())
}

pub async fn delete_all<'e>(db: impl PgExecutor<'e>, user_id: Uuid) -> AppResult<()> {
    sqlx::query!(
        r#"DELETE FROM mfa_recovery_codes WHERE user_id = $1"#,
        user_id
    )
    .execute(db)
    .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generated_codes_are_shown_in_two_groups_and_parse_back() {
        let code = NormalizedCode::generate();
        let shown = code.display();

        assert_eq!(shown.len(), SYMBOLS_PER_CODE + 1);
        assert_eq!(shown.as_bytes()[GROUP_LEN], b'-');
        assert_eq!(NormalizedCode::parse(&shown), Some(code));
    }

    #[test]
    fn typing_variations_are_forgiven() {
        let expected = NormalizedCode::parse("10ABC-DEF23").unwrap();

        for typed in [
            "10abc-def23",
            "10ABCDEF23",
            " 10ABC DEF23 ",
            "lOABC-DEF23",
            "IoABC-DEF23",
        ] {
            assert_eq!(
                NormalizedCode::parse(typed).as_ref(),
                Some(&expected),
                "{typed:?}"
            );
        }
    }

    #[test]
    fn malformed_codes_are_rejected() {
        for typed in ["", "ABCDE", "ABCDE-FGHJKM", "ABCDE-FGHJU", "ABCDE-FGH!K"] {
            assert_eq!(NormalizedCode::parse(typed), None, "{typed:?}");
        }
    }

    #[test]
    fn hashes_depend_on_the_secret() {
        let code = NormalizedCode::parse("ABCDE-FGHJK").unwrap();
        let one = RecoveryCodeHasher::new("first-secret");
        let other = RecoveryCodeHasher::new("second-secret");

        assert_eq!(one.digest(&code), one.digest(&code));
        assert_ne!(one.digest(&code), other.digest(&code));
    }
}
