use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// The colour scheme a user picked; `System` follows the device.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    #[default]
    System,
    Light,
    Dark,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserializes_only_the_schemes_the_app_offers() {
        for (raw, theme) in [
            ("system", Theme::System),
            ("light", Theme::Light),
            ("dark", Theme::Dark),
        ] {
            assert_eq!(
                serde_json::from_value::<Theme>(serde_json::json!(raw)).unwrap(),
                theme
            );
        }
        assert!(serde_json::from_str::<Theme>(r#""sepia""#).is_err());
    }
}
