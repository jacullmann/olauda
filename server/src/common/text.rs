use crate::error::{AppError, AppResult};

/// Free text people write and others read, such as a task description or a note:
/// trimmed and bounded in length. Unlike a [`DisplayName`] it may span several
/// lines, but it holds no other control characters, which never belong in
/// prose and which Postgres rejects in `text` columns in the case of NUL.
///
/// [`DisplayName`]: crate::common::names::DisplayName
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DisplayText(String);

impl DisplayText {
    /// `field` names the rejected input in the validation error, matching the
    /// field names `ValidatedJson` reports.
    pub fn parse(raw: &str, max_chars: usize, field: &str) -> AppResult<Self> {
        Self::parse_optional(Some(raw), max_chars, field)?
            .ok_or_else(|| AppError::Validation(vec![field.to_owned()]))
    }

    /// For fields that may be left out: missing or blank input is `None`.
    pub fn parse_optional(
        raw: Option<&str>,
        max_chars: usize,
        field: &str,
    ) -> AppResult<Option<Self>> {
        let Some(trimmed) = raw.map(str::trim).filter(|text| !text.is_empty()) else {
            return Ok(None);
        };

        let valid = trimmed.chars().count() <= max_chars
            && !trimmed
                .chars()
                .any(|c| c.is_control() && !matches!(c, '\n' | '\r' | '\t'));

        if valid {
            Ok(Some(Self(trimmed.to_owned())))
        } else {
            Err(AppError::Validation(vec![field.to_owned()]))
        }
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn surrounding_whitespace_is_dropped() {
        let text = DisplayText::parse("  Morgen frei  \n", 20, "content").unwrap();
        assert_eq!(text.as_str(), "Morgen frei");
    }

    #[test]
    fn inner_line_breaks_and_tabs_stay() {
        let text = DisplayText::parse("Zeile 1\r\n\tZeile 2", 20, "content").unwrap();
        assert_eq!(text.as_str(), "Zeile 1\r\n\tZeile 2");
    }

    #[test]
    fn blank_text_is_rejected_when_required() {
        assert!(DisplayText::parse(" \n\t ", 10, "content").is_err());
    }

    #[test]
    fn blank_or_missing_optional_text_is_none() {
        assert_eq!(DisplayText::parse_optional(None, 10, "note").unwrap(), None);
        assert_eq!(
            DisplayText::parse_optional(Some("  \n "), 10, "note").unwrap(),
            None
        );
    }

    #[test]
    fn length_counts_characters_not_bytes() {
        assert!(DisplayText::parse(&"ä".repeat(10), 10, "content").is_ok());
        assert!(DisplayText::parse(&"a".repeat(11), 10, "content").is_err());
        assert!(DisplayText::parse_optional(Some(&"a".repeat(11)), 10, "note").is_err());
    }

    #[test]
    fn other_control_characters_are_rejected() {
        assert!(DisplayText::parse("a\0b", 10, "content").is_err());
        assert!(DisplayText::parse("a\u{1b}[2Jb", 10, "content").is_err());
    }

    #[test]
    fn rejections_name_the_field() {
        let Err(AppError::Validation(fields)) = DisplayText::parse("", 10, "content") else {
            panic!("blank text must be a validation error");
        };
        assert_eq!(fields, ["content"]);
    }
}
