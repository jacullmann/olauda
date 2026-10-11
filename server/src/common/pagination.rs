//! Paging for the admin lists, which load further rows as they are scrolled.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

const DEFAULT_LIMIT: i64 = 50;
const MAX_LIMIT: i64 = 100;

/// How many rows to skip. Anything below zero reads as zero, so a hand-edited
/// request can never produce a negative offset.
#[derive(Debug, Clone, Copy, Default, Deserialize)]
#[serde(from = "Option<i64>")]
pub struct Offset(i64);

impl From<Option<i64>> for Offset {
    fn from(raw: Option<i64>) -> Self {
        Self(raw.unwrap_or(0).max(0))
    }
}

impl Offset {
    pub const fn get(self) -> i64 {
        self.0
    }
}

/// How many rows to return, capped so no request can ask for a whole table.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(from = "Option<i64>")]
pub struct Limit(i64);

impl Default for Limit {
    fn default() -> Self {
        Self(DEFAULT_LIMIT)
    }
}

impl From<Option<i64>> for Limit {
    fn from(raw: Option<i64>) -> Self {
        Self(raw.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT))
    }
}

impl Limit {
    pub const fn get(self) -> i64 {
        self.0
    }
}

#[derive(Debug, Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SortOrder {
    Asc,
    #[default]
    Desc,
}

impl SortOrder {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Asc => "asc",
            Self::Desc => "desc",
        }
    }
}

/// The rows of a list from an offset on, with how many match in all, so the
/// client can size its scrollbar before it has loaded everything.
#[derive(Debug, Serialize)]
pub struct Window<T> {
    pub items: Vec<T>,
    pub total: i64,
}

/// Turns free text into an `ILIKE` substring pattern. The wildcards are
/// escaped so a search for `50%` matches literally instead of everything.
pub fn contains_pattern(search: &str) -> String {
    let mut pattern = String::with_capacity(search.len() + 2);
    pattern.push('%');
    for c in search.chars() {
        if matches!(c, '%' | '_' | '\\') {
            pattern.push('\\');
        }
        pattern.push(c);
    }
    pattern.push('%');
    pattern
}

/// Normalises an optional search parameter: blank input means "no search".
pub fn search_term(raw: Option<&str>) -> Option<&str> {
    raw.map(str::trim).filter(|s| !s.is_empty())
}

/// Splits a search into the text pattern and, when it is one, the exact id.
pub fn search_params(raw: Option<&str>) -> (Option<String>, Option<Uuid>) {
    let term = search_term(raw);
    (
        term.map(contains_pattern),
        term.and_then(|t| Uuid::parse_str(t).ok()),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn offset_clamps_to_zero() {
        assert_eq!(Offset::from(None).get(), 0);
        assert_eq!(Offset::from(Some(-5)).get(), 0);
        assert_eq!(Offset::from(Some(150)).get(), 150);
    }

    #[test]
    fn limit_stays_within_bounds() {
        assert_eq!(Limit::from(None).get(), DEFAULT_LIMIT);
        assert_eq!(Limit::from(Some(0)).get(), 1);
        assert_eq!(Limit::from(Some(10_000)).get(), MAX_LIMIT);
        assert_eq!(Limit::from(Some(20)).get(), 20);
    }

    #[test]
    fn contains_pattern_escapes_wildcards() {
        assert_eq!(contains_pattern("abc"), "%abc%");
        assert_eq!(contains_pattern("50%_a\\b"), "%50\\%\\_a\\\\b%");
    }

    #[test]
    fn blank_search_is_ignored() {
        assert_eq!(search_term(Some("  ")), None);
        assert_eq!(search_term(Some(" max ")), Some("max"));
        assert_eq!(search_term(None), None);
    }
}
