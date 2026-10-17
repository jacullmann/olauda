use crate::common::role::Role;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(
    Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize, ToSchema,
)]
#[serde(rename_all = "snake_case")]
pub enum Permission {
    EditGroupProfile,
    EditGroupConfiguration,
    EditSubjectsCourses,
    EditSchedule,
    CreateItems,
    UploadImages,
    ManageNotes,
    ManageScheduleChanges,
    ManageAnnouncements,
    ModerateMembers,
    EditOtherContent,
    DeleteOtherContent,
    InviteMembers,
}

impl Permission {
    pub const fn as_str(&self) -> &'static str {
        match self {
            Self::EditGroupProfile => "edit_group_profile",
            Self::EditGroupConfiguration => "edit_group_configuration",
            Self::EditSubjectsCourses => "edit_subjects_courses",
            Self::EditSchedule => "edit_schedule",
            Self::CreateItems => "create_items",
            Self::UploadImages => "upload_images",
            Self::ManageNotes => "manage_notes",
            Self::ManageScheduleChanges => "manage_schedule_changes",
            Self::ManageAnnouncements => "manage_announcements",
            Self::ModerateMembers => "moderate_members",
            Self::EditOtherContent => "edit_other_content",
            Self::DeleteOtherContent => "delete_other_content",
            Self::InviteMembers => "invite_members",
        }
    }

    pub const ALL: [Permission; 13] = [
        Self::EditGroupProfile,
        Self::EditGroupConfiguration,
        Self::EditSubjectsCourses,
        Self::EditSchedule,
        Self::CreateItems,
        Self::UploadImages,
        Self::ManageNotes,
        Self::ManageScheduleChanges,
        Self::ManageAnnouncements,
        Self::ModerateMembers,
        Self::EditOtherContent,
        Self::DeleteOtherContent,
        Self::InviteMembers,
    ];

    pub fn from_str(s: &str) -> Option<Self> {
        Self::ALL.into_iter().find(|p| p.as_str() == s)
    }

    /// Moderation-grade permissions are never granted to every member. `None`
    /// marks a permission the group cannot reassign at all.
    pub const fn lowest_role(self) -> Option<Role> {
        match self {
            Self::EditGroupConfiguration => None,
            Self::EditSubjectsCourses
            | Self::EditSchedule
            | Self::ManageAnnouncements
            | Self::ModerateMembers
            | Self::EditOtherContent
            | Self::DeleteOtherContent => Some(Role::Moderator),
            Self::EditGroupProfile
            | Self::CreateItems
            | Self::UploadImages
            | Self::ManageNotes
            | Self::ManageScheduleChanges
            | Self::InviteMembers => Some(Role::User),
        }
    }

    /// Superadmin is never a requirement: it would lock the group's own owner out.
    pub fn accepts(self, required: Role) -> bool {
        required != Role::Superadmin
            && self
                .lowest_role()
                .is_some_and(|lowest| required.dominates(lowest))
    }
}

/// The lowest role each permission requires.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct GroupPermissions {
    pub edit_group_profile: Role,
    pub edit_subjects_courses: Role,
    pub edit_schedule: Role,
    pub create_items: Role,
    pub upload_images: Role,
    pub manage_notes: Role,
    pub manage_schedule_changes: Role,
    pub manage_announcements: Role,
    pub moderate_members: Role,
    pub edit_other_content: Role,
    pub delete_other_content: Role,
    pub invite_members: Role,
}

impl Default for GroupPermissions {
    fn default() -> Self {
        Self {
            edit_group_profile: Role::Moderator,
            edit_subjects_courses: Role::Admin,
            edit_schedule: Role::Admin,
            create_items: Role::User,
            upload_images: Role::User,
            manage_notes: Role::Moderator,
            manage_schedule_changes: Role::Moderator,
            manage_announcements: Role::Moderator,
            moderate_members: Role::Moderator,
            edit_other_content: Role::Moderator,
            delete_other_content: Role::Moderator,
            invite_members: Role::User,
        }
    }
}

impl GroupPermissions {
    pub fn required_role(&self, permission: Permission) -> Role {
        match permission {
            Permission::EditGroupProfile => self.edit_group_profile,
            // Switching the group type or Dalton rewires subjects, courses and
            // the schedule at once, so it stays with admins in every group.
            Permission::EditGroupConfiguration => Role::Admin,
            Permission::EditSubjectsCourses => self.edit_subjects_courses,
            Permission::EditSchedule => self.edit_schedule,
            Permission::CreateItems => self.create_items,
            Permission::UploadImages => self.upload_images,
            Permission::ManageNotes => self.manage_notes,
            Permission::ManageScheduleChanges => self.manage_schedule_changes,
            Permission::ManageAnnouncements => self.manage_announcements,
            Permission::ModerateMembers => self.moderate_members,
            Permission::EditOtherContent => self.edit_other_content,
            Permission::DeleteOtherContent => self.delete_other_content,
            Permission::InviteMembers => self.invite_members,
        }
    }

    fn required_role_mut(&mut self, permission: Permission) -> Option<&mut Role> {
        let role = match permission {
            Permission::EditGroupProfile => &mut self.edit_group_profile,
            Permission::EditGroupConfiguration => return None,
            Permission::EditSubjectsCourses => &mut self.edit_subjects_courses,
            Permission::EditSchedule => &mut self.edit_schedule,
            Permission::CreateItems => &mut self.create_items,
            Permission::UploadImages => &mut self.upload_images,
            Permission::ManageNotes => &mut self.manage_notes,
            Permission::ManageScheduleChanges => &mut self.manage_schedule_changes,
            Permission::ManageAnnouncements => &mut self.manage_announcements,
            Permission::ModerateMembers => &mut self.moderate_members,
            Permission::EditOtherContent => &mut self.edit_other_content,
            Permission::DeleteOtherContent => &mut self.delete_other_content,
            Permission::InviteMembers => &mut self.invite_members,
        };
        Some(role)
    }

    /// Groups store only what they changed, so every permission missing from
    /// `raw` keeps its default. That also covers permissions added later.
    pub fn from_json_with_defaults(raw: &serde_json::Value) -> Self {
        let mut perms = Self::default();
        perms.apply_overrides(raw);
        perms
    }

    /// Stored overrides are read leniently: unknown keys and roles a
    /// permission does not accept keep the default.
    fn apply_overrides(&mut self, raw: &serde_json::Value) {
        let Some(obj) = raw.as_object() else {
            return;
        };

        let overrides = obj.iter().filter_map(|(key, val)| {
            Some((Permission::from_str(key)?, Role::from_str(val.as_str()?)?))
        });
        for (permission, role) in overrides {
            if permission.accepts(role) {
                self.set_required_role(permission, role);
            }
        }
    }

    /// Callers validate the roles first (see [`Permission::accepts`]).
    pub fn set_required_role(&mut self, permission: Permission, role: Role) {
        if let Some(required) = self.required_role_mut(permission) {
            *required = role;
        }
    }

    pub fn allows(&self, standing: Standing, permission: Permission) -> bool {
        match standing {
            Standing::OwnerRights => true,
            Standing::Muted => false,
            Standing::Member(role) => role.dominates(self.required_role(permission)),
        }
    }

    pub fn effective_permissions(&self, standing: Standing) -> Vec<Permission> {
        Permission::ALL
            .into_iter()
            .filter(|&p| self.allows(standing, p))
            .collect()
    }
}

/// What bounds a caller in a group before the matrix is consulted.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Standing {
    /// The owner or a superadmin: every permission, whatever the matrix says.
    OwnerRights,
    /// Reads the group but holds no permission, even one the matrix grants
    /// every member.
    Muted,
    Member(Role),
}

impl Standing {
    /// Owner rights outrank a mute, so a muted superadmin or owner keeps
    /// every right.
    pub fn resolve(role: Role, has_owner_rights: bool, is_muted: bool) -> Self {
        match (has_owner_rights, is_muted) {
            (true, _) => Self::OwnerRights,
            (false, true) => Self::Muted,
            (false, false) => Self::Member(role),
        }
    }
}

#[macro_export]
macro_rules! require_permission {
    ($tc:expr, $perm:expr) => {
        $tc.require($perm)?
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_match_original_hardcodes() {
        let p = GroupPermissions::default();
        assert_eq!(p.create_items, Role::User);
        assert_eq!(p.upload_images, Role::User);
        assert_eq!(p.edit_group_profile, Role::Moderator);
        assert_eq!(p.manage_notes, Role::Moderator);
        assert_eq!(p.manage_schedule_changes, Role::Moderator);
        assert_eq!(p.manage_announcements, Role::Moderator);
        assert_eq!(p.moderate_members, Role::Moderator);
        assert_eq!(p.edit_other_content, Role::Moderator);
        assert_eq!(p.delete_other_content, Role::Moderator);
        assert_eq!(p.edit_subjects_courses, Role::Admin);
        assert_eq!(p.edit_schedule, Role::Admin);
    }

    #[test]
    fn json_merge_overrides_and_ignores_superadmin() {
        let raw = serde_json::json!({
            "create_items": "moderator",
            "create_items_typo": "user",
            "upload_images": "superadmin",
        });
        let p = GroupPermissions::from_json_with_defaults(&raw);
        assert_eq!(p.create_items, Role::Moderator);
        assert_eq!(p.upload_images, Role::User); // default
    }

    #[test]
    fn json_roundtrip() {
        let original = GroupPermissions::default();
        let json = serde_json::json!(original);
        let restored = GroupPermissions::from_json_with_defaults(&json);
        assert_eq!(original, restored);
    }

    #[test]
    fn stored_overrides_skip_roles_a_permission_does_not_accept() {
        let p = GroupPermissions::from_json_with_defaults(&serde_json::json!({
            "edit_other_content": "admin",
            "delete_other_content": "user",
            "manage_notes": "user",
        }));
        assert_eq!(p.edit_other_content, Role::Admin);
        assert_eq!(p.delete_other_content, Role::Moderator);
        assert_eq!(p.manage_notes, Role::User);
    }

    #[test]
    fn defaults_are_accepted_by_their_permissions() {
        let p = GroupPermissions::default();
        for permission in Permission::ALL
            .into_iter()
            .filter(|p| p.lowest_role().is_some())
        {
            assert!(
                permission.accepts(p.required_role(permission)),
                "{permission:?}"
            );
        }
    }

    #[test]
    fn group_configuration_stays_admin_only() {
        let mut p = GroupPermissions::from_json_with_defaults(&serde_json::json!({
            "edit_group_configuration": "user",
        }));
        assert_eq!(
            p.required_role(Permission::EditGroupConfiguration),
            Role::Admin
        );

        p.set_required_role(Permission::EditGroupConfiguration, Role::User);
        assert_eq!(
            p.required_role(Permission::EditGroupConfiguration),
            Role::Admin
        );

        assert!(!Permission::EditGroupConfiguration.accepts(Role::Admin));
        assert!(
            !serde_json::json!(p)
                .as_object()
                .is_some_and(|matrix| matrix.contains_key("edit_group_configuration"))
        );
        assert!(
            !p.effective_permissions(Standing::Member(Role::Moderator))
                .contains(&Permission::EditGroupConfiguration)
        );
        assert!(
            p.effective_permissions(Standing::Member(Role::Admin))
                .contains(&Permission::EditGroupConfiguration)
        );
    }

    #[test]
    fn effective_permissions_user_role() {
        let p = GroupPermissions::default();
        let granted = p.effective_permissions(Standing::Member(Role::User));
        assert!(granted.contains(&Permission::CreateItems));
        assert!(!granted.contains(&Permission::EditOtherContent));
        assert!(!granted.contains(&Permission::DeleteOtherContent));
        assert!(!granted.contains(&Permission::EditSubjectsCourses));
    }

    #[test]
    fn effective_permissions_admin_gets_everything() {
        let p = GroupPermissions::default();
        let granted = p.effective_permissions(Standing::Member(Role::Admin));
        assert_eq!(granted.len(), Permission::ALL.len());
    }

    #[test]
    fn effective_permissions_owner_rights_override_matrix() {
        let p = GroupPermissions::default();
        assert_eq!(
            p.effective_permissions(Standing::OwnerRights).len(),
            Permission::ALL.len()
        );
    }

    #[test]
    fn muted_members_hold_no_permission() {
        let everyone = GroupPermissions::from_json_with_defaults(&serde_json::json!({
            "edit_group_profile": "user",
        }));
        assert!(everyone.effective_permissions(Standing::Muted).is_empty());
        assert!(
            Permission::ALL
                .into_iter()
                .all(|p| !everyone.allows(Standing::Muted, p))
        );
    }

    #[test]
    fn owner_rights_outrank_a_mute() {
        assert_eq!(
            Standing::resolve(Role::User, true, true),
            Standing::OwnerRights
        );
        assert_eq!(Standing::resolve(Role::User, false, true), Standing::Muted);
        assert_eq!(
            Standing::resolve(Role::Moderator, false, false),
            Standing::Member(Role::Moderator)
        );
    }

    #[test]
    fn permission_str_roundtrip() {
        for p in Permission::ALL {
            assert_eq!(Permission::from_str(p.as_str()), Some(p));
        }
    }
}
