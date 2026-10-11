use super::messages::{CONTACT_EMAIL, LegalFooter, Message};

const LAYOUT: &str = include_str!("layout.html");

impl Message {
    pub fn to_html(&self) -> String {
        LAYOUT
            .replace("{{lang}}", self.locale.as_str())
            .replace("{{title}}", &self.subject)
            .replace("{{preheader}}", self.preheader)
            .replace("{{content}}", &self.content_html())
            .replace(
                "{{disclaimer}}",
                &self.disclaimer.map(disclaimer_html).unwrap_or_default(),
            )
            .replace("{{legal}}", &self.legal_footer().to_html())
    }

    fn legal_footer(&self) -> LegalFooter {
        LegalFooter::for_locale(self.locale)
    }

    pub fn to_text(&self) -> String {
        let mut blocks = vec![self.heading.to_owned()];
        blocks.extend(self.paragraphs.iter().map(|p| (*p).to_owned()));

        blocks.extend(self.code.clone());
        blocks.extend(self.note.clone());
        blocks.extend(self.disclaimer.map(str::to_owned));
        blocks.push(self.legal_footer().to_text());

        blocks.join("\n\n") + "\n"
    }

    fn content_html(&self) -> String {
        let mut html = format!(
            r#"<h1 class="text-body" style="margin: 0; font-size: 24px; line-height: 32px; font-weight: 700; letter-spacing: -0.02em; color: #333333;">{}</h1>"#,
            self.heading
        );

        for paragraph in self.paragraphs {
            html.push_str(&format!(
                r#"<p class="text-body" style="margin: 12px 0 0; font-size: 17px; line-height: 25px; color: #333333;">{paragraph}</p>"#
            ));
        }

        if let Some(code) = &self.code {
            html.push_str(&code_html(code));
        }

        if let Some(note) = &self.note {
            html.push_str(&format!(
                r#"<p class="text-muted" style="margin: 0; font-size: 13px; line-height: 20px; color: #555555;">{note}</p>"#
            ));
        }

        html
    }
}

fn code_html(code: &str) -> String {
    let code = escape_html(code);
    format!(
        r#"<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td align="center""><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td class="text-body" style="text-align: center; padding: 32px 0; font-size: 28px; line-height: 36px; font-weight: 700; letter-spacing: 0.1em; color: #333333;">{code}</td></tr></table></td></tr></table>"#
    )
}

fn disclaimer_html(disclaimer: &str) -> String {
    format!(
        r#"<tr><td style="padding: 24px 8px 0;"><p class="text-subtle" style="margin: 0; font-size: 12px; line-height: 18px; color: #888888;">{disclaimer}</p></td></tr>"#
    )
}

impl LegalFooter {
    fn to_html(&self) -> String {
        let link = |label: &str, href: &str| {
            format!(
                r#"<a class="text-muted" href="{href}" target="_blank" rel="noopener" style="color: #555555; text-decoration: underline;">{label}</a>"#
            )
        };
        let separator = "&nbsp;&nbsp;&middot;&nbsp;&nbsp;";
        let links = [
            link(self.privacy_label, self.privacy_url),
            link(self.imprint_label, self.imprint_url),
            link(self.contact_label, &format!("mailto:{CONTACT_EMAIL}")),
        ]
        .join(separator);

        format!(
            r#"<tr><td style="padding: 32px 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td class="divider" style="padding-top: 24px; border-top: 1px solid #e6e6e6;"><p class="text-muted" style="margin: 0; font-size: 12px; line-height: 18px; color: #555555;">{links}</p><p class="text-subtle" style="margin: 12px 0 0; font-size: 12px; line-height: 18px; color: #888888;">{notice}<br>{sender}</p></td></tr></table></td></tr>"#,
            notice = self.automated_notice,
            sender = self.sender,
        )
    }

    fn to_text(&self) -> String {
        format!(
            "---\n{}: {}\n{}: {}\n{}: {CONTACT_EMAIL}\n\n{}\n{}",
            self.privacy_label,
            self.privacy_url,
            self.imprint_label,
            self.imprint_url,
            self.contact_label,
            self.automated_notice,
            self.sender,
        )
    }
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::common::{email::SecurityNotice, locale::Locale};

    const SECURITY_NOTICES: [SecurityNotice; 13] = [
        SecurityNotice::PasswordChanged,
        SecurityNotice::PasswordSet,
        SecurityNotice::PasswordRemoved,
        SecurityNotice::PasswordReset,
        SecurityNotice::TwoFactorEnabled,
        SecurityNotice::TwoFactorDisabled,
        SecurityNotice::TwoFactorResetBySupport,
        SecurityNotice::RecoveryCodesRegenerated,
        SecurityNotice::RecoveryCodeUsed { remaining: 7 },
        SecurityNotice::PasskeyAdded,
        SecurityNotice::PasskeyRemoved,
        SecurityNotice::GoogleLinked,
        SecurityNotice::GoogleUnlinked,
    ];

    #[test]
    fn html_fills_every_placeholder() {
        for locale in [Locale::De, Locale::En] {
            let messages = [
                Message::verification(locale, "123456", 48),
                Message::password_reset(locale, "123456", 30),
                Message::password_setup(locale, "123456", 30),
            ]
            .into_iter()
            .chain(
                SECURITY_NOTICES
                    .into_iter()
                    .map(|event| Message::security_notice(locale, event)),
            );

            for message in messages {
                let html = message.to_html();
                assert!(
                    !html.contains("{{"),
                    "unfilled placeholder in {}",
                    message.subject
                );
                assert!(html.contains(&format!(r#"lang="{}""#, locale.as_str())));

                let legal = LegalFooter::for_locale(locale);
                assert!(html.contains(legal.privacy_url));
                assert!(message.to_text().contains(legal.privacy_url));
            }
        }
    }

    #[test]
    fn a_used_recovery_code_reports_how_many_are_left() {
        let event = SecurityNotice::RecoveryCodeUsed { remaining: 7 };
        for locale in [Locale::De, Locale::En] {
            let message = Message::security_notice(locale, event);
            assert!(message.to_html().contains('7'));
            assert!(message.to_text().contains('7'));
        }
    }

    #[test]
    fn codes_reach_both_bodies() {
        for message in [
            Message::verification(Locale::En, "042817", 48),
            Message::password_reset(Locale::De, "042817", 30),
            Message::password_setup(Locale::De, "042817", 30),
        ] {
            assert!(message.to_html().contains("042817"));
            assert!(message.to_text().contains("042817"));
        }
    }
}
