use serde::{Deserialize, Serialize};
use sqlx::PgExecutor;
use utoipa::ToSchema;
use uuid::Uuid;

/// The channel every instance listens on.
pub const CHANNEL: &str = "realtime";

/// What changed. Events carry no content: a client reloads what shows the
/// change through the regular endpoints, which authorize every read, so an
/// event can never reveal more than its recipient may see anyway.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(tag = "scope", rename_all = "camelCase")]
pub enum Event {
    #[serde(rename_all = "camelCase")]
    Group {
        group_id: Uuid,
        topic: GroupTopic,
    },
    Account {
        topic: AccountTopic,
    },
    Platform {
        topic: PlatformTopic,
    },
    /// Events may have been missed, so everything shown has to be reloaded.
    Resync,
}

/// A part of one group.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum GroupTopic {
    Tasks,
    Announcements,
    Schedule,
    /// Subjects and their courses.
    Subjects,
    /// Who belongs to the group, with their roles, mutes, bans and invites.
    Members,
    /// The group's name, picture, permissions and other settings.
    Settings,
    /// The recipient's own checks, pins and archive of the group's tasks.
    TaskMarks,
    /// The recipient's own course selection in the group.
    Courses,
}

/// A part of the recipient's own account.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum AccountTopic {
    /// The groups the user belongs to, or their standing in one of them.
    Groups,
    Todos,
    /// Preferences, personalization and dismissed notices.
    Profile,
    /// Sign-in methods, passkeys, two-factor authentication and sessions.
    Security,
}

/// Something every user sees.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub enum PlatformTopic {
    SystemAnnouncements,
    /// Shutdown and paused sign-ups.
    Access,
}

/// Who an event is for.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "to", content = "id", rename_all = "camelCase")]
pub enum Audience {
    Members(Uuid),
    User(Uuid),
    Everyone,
}

/// An event together with its audience. The constructors keep the two
/// consistent: a group's event goes to its members, an account's to its
/// owner.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Notice {
    audience: Audience,
    event: Event,
}

impl Notice {
    /// A change to what every member of the group sees.
    pub const fn group(group_id: Uuid, topic: GroupTopic) -> Self {
        Self {
            audience: Audience::Members(group_id),
            event: Event::Group { group_id, topic },
        }
    }

    /// A change to the group that only one member sees, such as their marks.
    pub const fn member(user_id: Uuid, group_id: Uuid, topic: GroupTopic) -> Self {
        Self {
            audience: Audience::User(user_id),
            event: Event::Group { group_id, topic },
        }
    }

    pub const fn account(user_id: Uuid, topic: AccountTopic) -> Self {
        Self {
            audience: Audience::User(user_id),
            event: Event::Account { topic },
        }
    }

    pub const fn platform(topic: PlatformTopic) -> Self {
        Self {
            audience: Audience::Everyone,
            event: Event::Platform { topic },
        }
    }

    /// A change to what everyone sees that only one user made, such as
    /// reading a system announcement.
    pub const fn platform_for(user_id: Uuid, topic: PlatformTopic) -> Self {
        Self {
            audience: Audience::User(user_id),
            event: Event::Platform { topic },
        }
    }

    /// Tells every stream that notices may have been lost.
    pub(super) const fn resync() -> Self {
        Self {
            audience: Audience::Everyone,
            event: Event::Resync,
        }
    }

    pub const fn audience(&self) -> Audience {
        self.audience
    }

    pub const fn event(&self) -> Event {
        self.event
    }
}

/// Sends `notices` once the surrounding transaction commits, or at once
/// outside of one. A rolled-back change is never announced.
pub async fn publish<'e>(
    db: impl PgExecutor<'e>,
    notices: impl IntoIterator<Item = Notice>,
) -> Result<(), sqlx::Error> {
    let payloads = notices
        .into_iter()
        .map(|notice| serde_json::to_string(&notice))
        .collect::<Result<Vec<_>, _>>()
        .map_err(|err| sqlx::Error::Encode(err.into()))?;

    if payloads.is_empty() {
        return Ok(());
    }

    sqlx::query!(
        r#"SELECT count(pg_notify($1, payload)) AS "sent!" FROM unnest($2::text[]) AS payload"#,
        CHANNEL,
        &payloads
    )
    .fetch_one(db)
    .await?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn group_notices_reach_the_members() {
        let group_id = Uuid::new_v4();
        let notice = Notice::group(group_id, GroupTopic::Tasks);

        assert_eq!(notice.audience(), Audience::Members(group_id));
        assert_eq!(
            notice.event(),
            Event::Group {
                group_id,
                topic: GroupTopic::Tasks
            }
        );
    }

    #[test]
    fn personal_group_notices_reach_only_the_member() {
        let (user_id, group_id) = (Uuid::new_v4(), Uuid::new_v4());
        let notice = Notice::member(user_id, group_id, GroupTopic::TaskMarks);

        assert_eq!(notice.audience(), Audience::User(user_id));
    }

    #[test]
    fn events_serialize_for_clients() {
        let group_id = Uuid::nil();
        let json = serde_json::to_value(Event::Group {
            group_id,
            topic: GroupTopic::TaskMarks,
        })
        .unwrap();

        assert_eq!(
            json,
            serde_json::json!({ "scope": "group", "groupId": group_id, "topic": "taskMarks" })
        );
        assert_eq!(
            serde_json::to_value(Event::Resync).unwrap(),
            serde_json::json!({ "scope": "resync" })
        );
    }

    #[test]
    fn notices_survive_the_round_trip_through_postgres() {
        let notice = Notice::account(Uuid::new_v4(), AccountTopic::Todos);
        let payload = serde_json::to_string(&notice).unwrap();

        assert_eq!(serde_json::from_str::<Notice>(&payload).unwrap(), notice);
    }
}
