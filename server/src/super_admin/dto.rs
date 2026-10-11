use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use uuid::Uuid;

use crate::common::{
    hetzner::MetricPoint,
    name_generator::generate_user_name,
    pagination::{Limit, Offset, SortOrder},
    role::MemberRole,
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangeMembershipRoleDto {
    pub role: MemberRole,
}

#[derive(Debug, Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum UserStatusFilter {
    #[default]
    All,
    Active,
    Banned,
    Superadmin,
}

impl UserStatusFilter {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::All => "all",
            Self::Active => "active",
            Self::Banned => "banned",
            Self::Superadmin => "superadmin",
        }
    }
}

#[derive(Debug, Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum UserSort {
    #[default]
    CreatedAt,
    LastLoginAt,
    Email,
}

impl UserSort {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::CreatedAt => "createdAt",
            Self::LastLoginAt => "lastLoginAt",
            Self::Email => "email",
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsersQuery {
    #[serde(default)]
    pub offset: Offset,
    #[serde(default)]
    pub limit: Limit,
    pub search: Option<String>,
    #[serde(default)]
    pub status: UserStatusFilter,
    #[serde(default)]
    pub sort: UserSort,
    #[serde(default)]
    pub order: SortOrder,
}

#[derive(Debug, Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GroupTypeFilter {
    #[default]
    All,
    Regular,
    Abitur,
}

impl GroupTypeFilter {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::All => "all",
            Self::Regular => "regular",
            Self::Abitur => "abitur",
        }
    }
}

#[derive(Debug, Clone, Copy, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GroupSort {
    #[default]
    CreatedAt,
    Name,
    MemberCount,
    ItemCount,
}

impl GroupSort {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::CreatedAt => "createdAt",
            Self::Name => "name",
            Self::MemberCount => "memberCount",
            Self::ItemCount => "itemCount",
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupsQuery {
    #[serde(default)]
    pub offset: Offset,
    #[serde(default)]
    pub limit: Limit,
    pub search: Option<String>,
    #[serde(default)]
    pub r#type: GroupTypeFilter,
    #[serde(default)]
    pub sort: GroupSort,
    #[serde(default)]
    pub order: SortOrder,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsDto {
    pub user_count: i64,
    /// Sign-ups whose link has not been opened yet; they are no accounts.
    pub pending_sign_ups: i64,
    pub admin_count: i64,
    pub banned_count: i64,
    pub new_users_this_week: i64,
    pub active_users_this_week: i64,
    pub item_count: i64,
    pub new_items_this_week: i64,
    pub report_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyActivityDto {
    pub day: NaiveDate,
    pub new_users: i64,
    pub new_groups: i64,
    pub new_items: i64,
    pub app_opens: i64,
    pub active_users: i64,
    pub failed_logins: i64,
}

pub const HOURS_PER_DAY: usize = 24;
pub const DAYS_PER_WEEK: usize = 7;

/// When in the week the app is used, in German local time. Each cell counts a
/// user at most once per day, so one person reloading the app all evening
/// does not outweigh a class opening it once.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeeklyRhythmDto {
    /// Whole weeks the counts span, so every hour of the week is sampled equally often.
    pub weeks: i32,
    /// Rows run Monday to Sunday, columns from 0:00 to 23:00.
    pub active_users: [[i64; HOURS_PER_DAY]; DAYS_PER_WEEK],
}

/// An account as the admin queries select it, before its name is derived.
#[derive(Debug)]
pub struct AdminUserRow {
    pub id: Uuid,
    pub email: String,
    pub mfa_enabled: bool,
    pub is_superadmin: bool,
    pub is_banned: bool,
    pub created_at: DateTime<Utc>,
    pub last_login_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminUserDto {
    pub id: Uuid,
    pub email: String,
    pub username: String,
    pub mfa_enabled: bool,
    pub is_superadmin: bool,
    pub is_banned: bool,
    pub created_at: DateTime<Utc>,
    pub last_login_at: Option<DateTime<Utc>>,
}

impl From<AdminUserRow> for AdminUserDto {
    fn from(row: AdminUserRow) -> Self {
        Self {
            username: generate_user_name(&row.id.to_string()),
            id: row.id,
            email: row.email,
            mfa_enabled: row.mfa_enabled,
            is_superadmin: row.is_superadmin,
            is_banned: row.is_banned,
            created_at: row.created_at,
            last_login_at: row.last_login_at,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminGroupDto {
    pub id: Uuid,
    pub name: String,
    pub avatar_url: Option<String>,
    pub group_type: String,
    pub owner_id: Uuid,
    pub owner_email: String,
    pub owner_name: String,
    pub created_at: DateTime<Utc>,
    pub member_count: i64,
    pub item_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserMembershipDto {
    pub group_id: Uuid,
    pub group_name: String,
    pub role: MemberRole,
    pub joined_at: DateTime<Utc>,
    pub assignable_roles: Vec<MemberRole>,
}

/// A pg_cron cleanup (or the asset worker), named as scheduled, with the rows
/// it should already have removed. Anything above zero means it is not running.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupJobDto {
    pub job: String,
    pub overdue_count: i64,
}

/// The time windows, ending now, that the server metrics can be shown for. A fixed set keeps
/// every request to the Hetzner API small and predictable.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
pub enum MetricsRange {
    #[serde(rename = "1h")]
    Hour,
    #[serde(rename = "24h")]
    Day,
    #[serde(rename = "7d")]
    Week,
    #[serde(rename = "30d")]
    Month,
}

impl MetricsRange {
    /// Samples per series whatever the window, enough for a smooth line at
    /// chart width without sending more points than there are pixels.
    const SAMPLES: u32 = 240;

    pub const fn span(self) -> Duration {
        const HOUR: u64 = 60 * 60;
        Duration::from_secs(match self {
            Self::Hour => HOUR,
            Self::Day => 24 * HOUR,
            Self::Week => 7 * 24 * HOUR,
            Self::Month => 30 * 24 * HOUR,
        })
    }

    pub fn step(self) -> Duration {
        self.span() / Self::SAMPLES
    }
}

#[derive(Debug, Deserialize)]
pub struct ServerMetricsQuery {
    pub range: MetricsRange,
}

/// The window is sent along so charts span all of it, even where the series
/// start late or have gaps.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerMetricsDto {
    pub start: i64,
    pub end: i64,
    pub cpu_cores: u32,
    pub cpu: Vec<MetricPoint>,
    pub network_in: Vec<MetricPoint>,
    pub network_out: Vec<MetricPoint>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_range_yields_the_same_number_of_whole_second_steps() {
        for range in [
            MetricsRange::Hour,
            MetricsRange::Day,
            MetricsRange::Week,
            MetricsRange::Month,
        ] {
            let step = range.step();
            assert_eq!(step.subsec_nanos(), 0, "{range:?}");
            assert_eq!(range.span().as_secs() / step.as_secs(), 240, "{range:?}");
        }
    }

    #[test]
    fn parses_ranges_from_their_short_names() {
        let parse = |raw: &str| serde_json::from_str::<MetricsRange>(&format!("\"{raw}\"")).ok();

        assert_eq!(parse("1h"), Some(MetricsRange::Hour));
        assert_eq!(parse("30d"), Some(MetricsRange::Month));
        assert_eq!(parse("90d"), None);
    }
}
