use serde::{Deserialize, Serialize};
use std::fmt;
use utoipa::ToSchema;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    Superadmin = 1,
    Admin = 2,
    Moderator = 3,
    User = 4,
}

impl Role {
    pub fn from_db_id(id: i64) -> Option<Self> {
        match id {
            1 => Some(Self::Superadmin),
            2 => Some(Self::Admin),
            3 => Some(Self::Moderator),
            4 => Some(Self::User),
            _ => None,
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "superadmin" => Some(Self::Superadmin),
            "admin" => Some(Self::Admin),
            "moderator" => Some(Self::Moderator),
            "user" => Some(Self::User),
            _ => None,
        }
    }

    pub fn from_str_or_user(s: &str) -> Self {
        Self::from_str(s).unwrap_or(Self::User)
    }

    pub const fn as_str(&self) -> &'static str {
        match self {
            Self::Superadmin => "superadmin",
            Self::Admin => "admin",
            Self::Moderator => "moderator",
            Self::User => "user",
        }
    }

    pub const fn db_id(&self) -> i64 {
        *self as i64
    }

    /// The same discriminant as [`Self::db_id`], for the columns typed `int4`.
    pub const fn db_id_i32(&self) -> i32 {
        *self as i32
    }

    pub fn dominates(self, required: Role) -> bool {
        self <= required
    }
}

/// A member's role as clients see it. Ownership lives in `groups.owner_id`
/// rather than `user_roles`, so it is folded in here to keep the single-owner
/// invariant enforced by the schema instead of by a second role row.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum MemberRole {
    Owner,
    Admin,
    Moderator,
    User,
}

impl MemberRole {
    pub fn resolve(tenant_role: Role, is_owner: bool) -> Self {
        if is_owner {
            return Self::Owner;
        }
        match tenant_role {
            Role::Superadmin | Role::Admin => Self::Admin,
            Role::Moderator => Self::Moderator,
            Role::User => Self::User,
        }
    }
}

impl fmt::Display for Role {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl From<Role> for String {
    fn from(r: Role) -> Self {
        r.as_str().to_owned()
    }
}

impl From<Role> for i64 {
    fn from(r: Role) -> Self {
        r.db_id()
    }
}

impl From<Role> for i32 {
    fn from(r: Role) -> Self {
        r.db_id_i32()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dominates_ordering() {
        assert!(Role::Superadmin.dominates(Role::Superadmin));
        assert!(Role::Superadmin.dominates(Role::Admin));
        assert!(Role::Superadmin.dominates(Role::Moderator));
        assert!(Role::Superadmin.dominates(Role::User));

        assert!(!Role::Admin.dominates(Role::Superadmin));
        assert!(Role::Admin.dominates(Role::Admin));
        assert!(Role::Admin.dominates(Role::Moderator));
        assert!(Role::Admin.dominates(Role::User));

        assert!(!Role::Moderator.dominates(Role::Superadmin));
        assert!(!Role::Moderator.dominates(Role::Admin));
        assert!(Role::Moderator.dominates(Role::Moderator));
        assert!(Role::Moderator.dominates(Role::User));

        assert!(!Role::User.dominates(Role::Superadmin));
        assert!(!Role::User.dominates(Role::Admin));
        assert!(!Role::User.dominates(Role::Moderator));
        assert!(Role::User.dominates(Role::User));
    }

    #[test]
    fn roundtrip_string() {
        for role in [Role::Superadmin, Role::Admin, Role::Moderator, Role::User] {
            assert_eq!(Role::from_str(role.as_str()), Some(role));
        }
    }

    #[test]
    fn roundtrip_db_id() {
        for role in [Role::Superadmin, Role::Admin, Role::Moderator, Role::User] {
            assert_eq!(Role::from_db_id(role.db_id()), Some(role));
        }
    }

    #[test]
    fn db_ids_match_existing_schema() {
        assert_eq!(Role::Superadmin.db_id(), 1);
        assert_eq!(Role::Admin.db_id(), 2);
        assert_eq!(Role::Moderator.db_id(), 3);
        assert_eq!(Role::User.db_id(), 4);
    }

    #[test]
    fn member_role_owner_overrides_tenant_role() {
        for role in [Role::Admin, Role::Moderator, Role::User] {
            assert_eq!(MemberRole::resolve(role, true), MemberRole::Owner);
        }
        assert_eq!(MemberRole::resolve(Role::Admin, false), MemberRole::Admin);
        assert_eq!(
            MemberRole::resolve(Role::Moderator, false),
            MemberRole::Moderator
        );
        assert_eq!(MemberRole::resolve(Role::User, false), MemberRole::User);
    }

    #[test]
    fn member_role_sorts_owner_first() {
        assert!(MemberRole::Owner < MemberRole::Admin);
        assert!(MemberRole::Admin < MemberRole::Moderator);
        assert!(MemberRole::Moderator < MemberRole::User);
    }

    #[test]
    fn unknown_returns_none_or_fallback() {
        assert_eq!(Role::from_str("god"), None);
        assert_eq!(Role::from_db_id(99), None);
        assert_eq!(Role::from_str_or_user("whatever"), Role::User);
    }
}
