use crate::common::locale::Locale;

pub(super) const CONTACT_EMAIL: &str = "contact@olauda.com";

/// Links point at the public homepage in every environment: the legal pages
/// only exist there, and the homepage prefixes every non-English route with
/// its locale.
pub(super) struct LegalFooter {
    pub privacy_label: &'static str,
    pub privacy_url: &'static str,
    pub imprint_label: &'static str,
    pub imprint_url: &'static str,
    pub contact_label: &'static str,
    pub automated_notice: &'static str,
    pub sender: &'static str,
}

impl LegalFooter {
    pub fn for_locale(locale: Locale) -> Self {
        match locale {
            Locale::De => Self {
                privacy_label: "Datenschutz",
                privacy_url: "https://olauda.com/de/legal/datenschutz",
                imprint_label: "Impressum",
                imprint_url: "https://olauda.com/de/legal/impressum",
                contact_label: "Kontakt",
                automated_notice: "Diese E-Mail wurde automatisch versendet. Bitte antworte nicht darauf.",
                sender: "Olauda · Berlin, Deutschland",
            },
            Locale::En => Self {
                privacy_label: "Privacy Policy",
                privacy_url: "https://olauda.com/legal/privacy-policy",
                imprint_label: "Imprint",
                imprint_url: "https://olauda.com/legal/imprint",
                contact_label: "Contact",
                automated_notice: "This email was sent automatically. Please don't reply to it.",
                sender: "Olauda · Berlin, Germany",
            },
        }
    }
}

pub(super) struct Message {
    pub locale: Locale,
    pub subject: String,
    pub preheader: &'static str,
    pub heading: &'static str,
    pub paragraphs: &'static [&'static str],
    pub code: Option<String>,
    pub note: Option<String>,
    pub disclaimer: Option<&'static str>,
}

impl Message {
    pub fn verification(locale: Locale, code: &str, valid_hours: u64) -> Self {
        match locale {
            Locale::De => Self {
                locale,
                subject: format!("{code} ist dein Olauda-Bestätigungscode"),
                preheader: "Dein Code, um dein Olauda-Konto zu aktivieren.",
                heading: "Nur noch ein letzter Schritt",
                paragraphs: &[
                    "Willkommen bei Olauda. Gib diesen Code auf der Olauda-Seite ein, um deine E-Mail-Adresse zu bestätigen:",
                ],
                code: Some(code.to_owned()),
                note: Some(format!("Der Code ist {valid_hours} Stunden gültig.")),
                disclaimer: Some(
                    "Du hast dich nicht bei Olauda registriert? Dann kannst du diese E-Mail einfach ignorieren.",
                ),
            },
            Locale::En => Self {
                locale,
                subject: format!("{code} is your Olauda verification code"),
                preheader: "Your code to activate your Olauda account.",
                heading: "Just one last step",
                paragraphs: &[
                    "Welcome to Olauda. Enter this code on the Olauda page to confirm your email address:",
                ],
                code: Some(code.to_owned()),
                note: Some(format!("The code is valid for {valid_hours} hours.")),
                disclaimer: Some("Didn't sign up for Olauda? You can safely ignore this email."),
            },
        }
    }

    pub fn password_reset(locale: Locale, code: &str, valid_minutes: u64) -> Self {
        match locale {
            Locale::De => Self {
                locale,
                subject: format!("{code} ist dein Code zum Zurücksetzen deines Passworts"),
                preheader: "Dein Code zum Zurücksetzen deines Passworts.",
                heading: "Passwort zurücksetzen",
                paragraphs: &[
                    "Gib diesen Code auf der Olauda-Seite ein, um ein neues Passwort festzulegen:",
                ],
                code: Some(code.to_owned()),
                note: Some(format!("Der Code ist {valid_minutes} Minuten gültig.")),
                disclaimer: Some(
                    "Du hast kein neues Passwort angefordert? Dann kannst du diese E-Mail ignorieren, dein Passwort bleibt unverändert.",
                ),
            },
            Locale::En => Self {
                locale,
                subject: format!("{code} is your password reset code"),
                preheader: "Your code to reset your password.",
                heading: "Reset your password",
                paragraphs: &["Enter this code on the Olauda page to choose a new password:"],
                code: Some(code.to_owned()),
                note: Some(format!("The code is valid for {valid_minutes} minutes.")),
                disclaimer: Some(
                    "Didn't request a new password? You can ignore this email, your password stays unchanged.",
                ),
            },
        }
    }

    pub fn password_setup(locale: Locale, code: &str, valid_minutes: u64) -> Self {
        match locale {
            Locale::De => Self {
                locale,
                subject: format!("{code} ist dein Code zum Festlegen deines Passworts"),
                preheader: "Dein Code, um ein Passwort für dein Konto festzulegen.",
                heading: "Passwort festlegen",
                paragraphs: &[
                    "Gib diesen Code auf der Olauda-Seite ein, um ein Passwort für dein Konto festzulegen:",
                ],
                code: Some(code.to_owned()),
                note: Some(format!("Der Code ist {valid_minutes} Minuten gültig.")),
                disclaimer: Some(
                    "Du hast das nicht angefordert? Dann kannst du diese E-Mail einfach ignorieren.",
                ),
            },
            Locale::En => Self {
                locale,
                subject: format!("{code} is your code to set a password"),
                preheader: "Your code to set a password for your account.",
                heading: "Set your password",
                paragraphs: &[
                    "Enter this code on the Olauda page to set a password for your account:",
                ],
                code: Some(code.to_owned()),
                note: Some(format!("The code is valid for {valid_minutes} minutes.")),
                disclaimer: Some("Didn't request this? You can safely ignore this email."),
            },
        }
    }

    pub fn security_notice(locale: Locale, event: SecurityNotice) -> Self {
        let notice = event.notice(locale);

        Self {
            locale,
            subject: notice.subject.to_owned(),
            preheader: notice.preheader,
            heading: match locale {
                Locale::De => "Wichtige Sicherheitsmeldung",
                Locale::En => "Important security notice",
            },
            paragraphs: notice.paragraphs,
            code: None,
            note: event.note(locale),
            disclaimer: None,
        }
    }
}

/// A change to how an account is secured. The owner is told about every one,
/// so a change they did not make cannot go unnoticed.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SecurityNotice {
    PasswordChanged,
    PasswordSet,
    PasswordRemoved,
    PasswordReset,
    TwoFactorEnabled,
    TwoFactorDisabled,
    TwoFactorResetBySupport,
    RecoveryCodesRegenerated,
    RecoveryCodeUsed { remaining: usize },
    PasskeyAdded,
    PasskeyRemoved,
    GoogleLinked,
    GoogleUnlinked,
}

struct NoticeText {
    subject: &'static str,
    preheader: &'static str,
    paragraphs: &'static [&'static str],
}

const ADVICE_DE: &str = "Warst du das nicht? Setze dein Passwort zurück, melde in den Kontoeinstellungen unter Sicherheit alle anderen Geräte ab und schreib uns an contact@olauda.com.";
const ADVICE_EN: &str = "Wasn't you? Reset your password, sign out all other devices under Security in your account settings and write to us at contact@olauda.com.";
const SUPPORT_ADVICE_DE: &str =
    "Hast du das nicht bei uns angefragt? Dann schreib uns bitte sofort an contact@olauda.com.";
const SUPPORT_ADVICE_EN: &str =
    "Didn't ask us for this? Please write to us at contact@olauda.com right away.";

impl SecurityNotice {
    fn notice(self, locale: Locale) -> NoticeText {
        let (subject, preheader, paragraphs): (_, _, &'static [&'static str]) = match (self, locale)
        {
            (Self::PasswordChanged, Locale::De) => (
                "Dein Passwort wurde geändert",
                "Das Passwort deines Olauda-Kontos wurde geändert.",
                &[
                    "Soeben wurde das Passwort deines Kontos geändert. Alle anderen Geräte wurden abgemeldet.",
                    ADVICE_DE,
                ],
            ),
            (Self::PasswordChanged, Locale::En) => (
                "Your password was changed",
                "The password of your Olauda account was changed.",
                &[
                    "The password of your account was just changed. All other devices were signed out.",
                    ADVICE_EN,
                ],
            ),
            (Self::PasswordSet, Locale::De) => (
                "Für dein Konto wurde ein Passwort festgelegt",
                "Dein Olauda-Konto hat jetzt ein Passwort.",
                &[
                    "Soeben wurde für dein Konto ein Passwort festgelegt. Du kannst dich jetzt auch mit E-Mail-Adresse und Passwort anmelden.",
                    ADVICE_DE,
                ],
            ),
            (Self::PasswordSet, Locale::En) => (
                "A password was set for your account",
                "Your Olauda account now has a password.",
                &[
                    "A password was just set for your account. You can now also sign in with your email address and password.",
                    ADVICE_EN,
                ],
            ),
            (Self::PasswordRemoved, Locale::De) => (
                "Das Passwort deines Kontos wurde entfernt",
                "Dein Olauda-Konto hat kein Passwort mehr.",
                &[
                    "Soeben wurde das Passwort deines Kontos entfernt. Du meldest dich jetzt mit einem Passkey oder mit Google an. Alle anderen Geräte wurden abgemeldet.",
                    ADVICE_DE,
                ],
            ),
            (Self::PasswordRemoved, Locale::En) => (
                "The password of your account was removed",
                "Your Olauda account no longer has a password.",
                &[
                    "The password of your account was just removed. You now sign in with a passkey or with Google. All other devices were signed out.",
                    ADVICE_EN,
                ],
            ),
            (Self::PasswordReset, Locale::De) => (
                "Dein Passwort wurde zurückgesetzt",
                "Das Passwort deines Olauda-Kontos wurde zurückgesetzt.",
                &[
                    "Soeben wurde das Passwort deines Kontos mit einem per E-Mail versandten Code zurückgesetzt. Alle Geräte wurden abgemeldet. Zwei-Faktor-Authentifizierung und Passkeys bleiben unverändert.",
                    ADVICE_DE,
                ],
            ),
            (Self::PasswordReset, Locale::En) => (
                "Your password was reset",
                "The password of your Olauda account was reset.",
                &[
                    "The password of your account was just reset with a code sent by email. All devices were signed out. Two-factor authentication and passkeys stay as they were.",
                    ADVICE_EN,
                ],
            ),
            (Self::TwoFactorEnabled, Locale::De) => (
                "Zwei-Faktor-Authentifizierung aktiviert",
                "Dein Olauda-Konto ist jetzt mit einem zweiten Faktor geschützt.",
                &[
                    "Soeben wurde für dein Konto die Zwei-Faktor-Authentifizierung aktiviert. Bewahre deine Wiederherstellungscodes sicher auf: Mit ihnen meldest du dich an, falls du keinen Zugriff auf deine Authenticator-App hast.",
                    ADVICE_DE,
                ],
            ),
            (Self::TwoFactorEnabled, Locale::En) => (
                "Two-factor authentication turned on",
                "Your Olauda account is now protected by a second factor.",
                &[
                    "Two-factor authentication was just turned on for your account. Keep your recovery codes somewhere safe: they let you sign in if you cannot use your authenticator app.",
                    ADVICE_EN,
                ],
            ),
            (Self::TwoFactorDisabled, Locale::De) => (
                "Zwei-Faktor-Authentifizierung deaktiviert",
                "Dein Olauda-Konto ist nicht mehr mit einem zweiten Faktor geschützt.",
                &[
                    "Soeben wurde die Zwei-Faktor-Authentifizierung deines Kontos deaktiviert. Deine Wiederherstellungscodes sind damit ungültig.",
                    ADVICE_DE,
                ],
            ),
            (Self::TwoFactorDisabled, Locale::En) => (
                "Two-factor authentication turned off",
                "Your Olauda account is no longer protected by a second factor.",
                &[
                    "Two-factor authentication was just turned off for your account. Your recovery codes no longer work.",
                    ADVICE_EN,
                ],
            ),
            (Self::TwoFactorResetBySupport, Locale::De) => (
                "Zwei-Faktor-Authentifizierung zurückgesetzt",
                "Unser Support hat die Zwei-Faktor-Authentifizierung deines Kontos zurückgesetzt.",
                &[
                    "Unser Support hat die Zwei-Faktor-Authentifizierung deines Kontos zurückgesetzt. Du kannst sie in den Kontoeinstellungen unter Sicherheit neu einrichten.",
                    SUPPORT_ADVICE_DE,
                ],
            ),
            (Self::TwoFactorResetBySupport, Locale::En) => (
                "Two-factor authentication reset",
                "Our support reset the two-factor authentication of your account.",
                &[
                    "Our support reset the two-factor authentication of your account. You can set it up again under Security in your account settings.",
                    SUPPORT_ADVICE_EN,
                ],
            ),
            (Self::RecoveryCodesRegenerated, Locale::De) => (
                "Neue Wiederherstellungscodes erstellt",
                "Für dein Olauda-Konto wurden neue Wiederherstellungscodes erstellt.",
                &[
                    "Soeben wurden für dein Konto neue Wiederherstellungscodes erstellt. Die bisherigen Codes funktionieren nicht mehr.",
                    ADVICE_DE,
                ],
            ),
            (Self::RecoveryCodesRegenerated, Locale::En) => (
                "New recovery codes created",
                "New recovery codes were created for your Olauda account.",
                &[
                    "New recovery codes were just created for your account. Your previous codes no longer work.",
                    ADVICE_EN,
                ],
            ),
            (Self::RecoveryCodeUsed { .. }, Locale::De) => (
                "Wiederherstellungscode verwendet",
                "Für dein Olauda-Konto wurde ein Wiederherstellungscode verwendet.",
                &[
                    "Soeben wurde für dein Konto ein Wiederherstellungscode anstelle der Authenticator-App verwendet. Jeder Code funktioniert nur einmal.",
                    ADVICE_DE,
                ],
            ),
            (Self::RecoveryCodeUsed { .. }, Locale::En) => (
                "Recovery code used",
                "A recovery code was used for your Olauda account.",
                &[
                    "A recovery code was just used for your account instead of the authenticator app. Each code works only once.",
                    ADVICE_EN,
                ],
            ),
            (Self::PasskeyAdded, Locale::De) => (
                "Neuer Passkey hinzugefügt",
                "Deinem Olauda-Konto wurde ein Passkey hinzugefügt.",
                &[
                    "Soeben wurde deinem Konto ein neuer Passkey hinzugefügt. Mit ihm kann man sich ohne Passwort anmelden.",
                    ADVICE_DE,
                ],
            ),
            (Self::PasskeyAdded, Locale::En) => (
                "New passkey added",
                "A passkey was added to your Olauda account.",
                &[
                    "A new passkey was just added to your account. It can be used to sign in without a password.",
                    ADVICE_EN,
                ],
            ),
            (Self::PasskeyRemoved, Locale::De) => (
                "Passkey entfernt",
                "Aus deinem Olauda-Konto wurde ein Passkey entfernt.",
                &[
                    "Soeben wurde ein Passkey aus deinem Konto entfernt. Mit ihm ist keine Anmeldung mehr möglich.",
                    ADVICE_DE,
                ],
            ),
            (Self::PasskeyRemoved, Locale::En) => (
                "Passkey removed",
                "A passkey was removed from your Olauda account.",
                &[
                    "A passkey was just removed from your account. It can no longer be used to sign in.",
                    ADVICE_EN,
                ],
            ),
            (Self::GoogleLinked, Locale::De) => (
                "Google-Konto verknüpft",
                "Dein Olauda-Konto wurde mit einem Google-Konto verknüpft.",
                &[
                    "Soeben wurde dein Konto mit einem Google-Konto verknüpft. Damit kann man sich über Google anmelden.",
                    ADVICE_DE,
                ],
            ),
            (Self::GoogleLinked, Locale::En) => (
                "Google account linked",
                "Your Olauda account was linked to a Google account.",
                &[
                    "Your account was just linked to a Google account, which can now be used to sign in.",
                    ADVICE_EN,
                ],
            ),
            (Self::GoogleUnlinked, Locale::De) => (
                "Google-Konto getrennt",
                "Die Verknüpfung deines Olauda-Kontos mit Google wurde aufgehoben.",
                &[
                    "Soeben wurde die Verknüpfung deines Kontos mit Google aufgehoben. Eine Anmeldung über Google ist nicht mehr möglich.",
                    ADVICE_DE,
                ],
            ),
            (Self::GoogleUnlinked, Locale::En) => (
                "Google account unlinked",
                "Your Olauda account was unlinked from Google.",
                &[
                    "Your account was just unlinked from Google. Signing in with Google is no longer possible.",
                    ADVICE_EN,
                ],
            ),
        };

        NoticeText {
            subject,
            preheader,
            paragraphs,
        }
    }

    fn note(self, locale: Locale) -> Option<String> {
        let Self::RecoveryCodeUsed { remaining } = self else {
            return None;
        };

        Some(match locale {
            Locale::De => format!(
                "Dir bleiben noch {remaining} Wiederherstellungscodes. In den Kontoeinstellungen kannst du jederzeit neue erstellen."
            ),
            Locale::En => format!(
                "You have {remaining} recovery codes left. You can create new ones in your account settings at any time."
            ),
        })
    }
}
