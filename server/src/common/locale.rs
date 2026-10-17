use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum Locale {
    #[default]
    De,
    En,
}

impl Locale {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::De => "de",
            Self::En => "en",
        }
    }

    /// Preferences are stored as free-form JSON, so rows written before the
    /// language was validated may hold anything.
    pub fn from_stored(value: Option<&str>) -> Self {
        match value {
            Some("en") => Self::En,
            _ => Self::De,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stored_values_fall_back_to_german() {
        assert_eq!(Locale::from_stored(Some("en")), Locale::En);
        assert_eq!(Locale::from_stored(Some("de")), Locale::De);
        assert_eq!(Locale::from_stored(Some("fr")), Locale::De);
        assert_eq!(Locale::from_stored(None), Locale::De);
    }

    #[test]
    fn deserializes_only_supported_languages() {
        assert_eq!(
            serde_json::from_str::<Locale>(r#""en""#).unwrap(),
            Locale::En
        );
        assert!(serde_json::from_str::<Locale>(r#""fr""#).is_err());
    }

    #[test]
    fn serialized_form_matches_as_str() {
        for locale in [Locale::De, Locale::En] {
            assert_eq!(
                serde_json::to_value(locale).unwrap(),
                serde_json::json!(locale.as_str())
            );
        }
    }
}
