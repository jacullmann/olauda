//! Who may change whose role, mute or remove whom inside a group.
//!
//! Members only ever act on people strictly below them and only hand out
//! roles strictly below their own, so nobody can create or remove a peer.
//! Owner rights (the owner and superadmins) lift that limit for everyone but
//! the owner, whose seat only changes hands through an ownership transfer.

use crate::{
    common::{
        extractors::TenantContext,
        permission::Permission,
        role::{MemberRole, Role},
    },
    error::{AppError, AppResult},
};
use uuid::Uuid;

#[derive(Debug, Clone, Copy)]
pub struct Actor {
    pub user_id: Uuid,
    pub role: MemberRole,
    pub has_owner_rights: bool,
    pub can_moderate_members: bool,
}

/// The request's caller before their group role is known. The role is read
/// inside the membership transaction so it cannot go stale mid-request.
#[derive(Debug, Clone, Copy)]
pub struct Caller {
    pub user_id: Uuid,
    pub is_superadmin: bool,
    pub moderate_members_role: Role,
}

impl Caller {
    pub fn from_tenant(tc: &TenantContext) -> Self {
        Self {
            user_id: tc.user.user_id,
            is_superadmin: tc.is_superadmin,
            moderate_members_role: tc
                .group_permissions
                .required_role(Permission::ModerateMembers),
        }
    }

    /// `tenant_role` is `None` for a superadmin who is not a member.
    pub fn resolve(self, owner_id: Uuid, tenant_role: Option<Role>) -> Actor {
        let is_owner = owner_id == self.user_id;
        let has_owner_rights = is_owner || self.is_superadmin;
        let tenant_role = tenant_role.unwrap_or(Role::User);

        Actor {
            user_id: self.user_id,
            role: MemberRole::resolve(tenant_role, is_owner),
            has_owner_rights,
            can_moderate_members: has_owner_rights
                || tenant_role.dominates(self.moderate_members_role),
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct Target {
    pub user_id: Uuid,
    pub role: MemberRole,
}

/// `MemberRole` orders owner first, so a larger value is a lower rank.
fn ranks_below(role: MemberRole, other: MemberRole) -> bool {
    role > other
}

fn assignable(role: Role) -> AppResult<MemberRole> {
    match role {
        Role::Admin => Ok(MemberRole::Admin),
        Role::Moderator => Ok(MemberRole::Moderator),
        Role::User => Ok(MemberRole::User),
        Role::Superadmin => Err(AppError::bad_request("Invalid role")),
    }
}

pub fn ensure_can_change_role(actor: Actor, target: Target, new_role: Role) -> AppResult<()> {
    let new_role = assignable(new_role)?;

    if target.role == MemberRole::Owner {
        return Err(AppError::forbidden(
            "The owner's role cannot be changed. Transfer ownership instead.",
        ));
    }

    if actor.has_owner_rights {
        return Ok(());
    }

    if actor.user_id == target.user_id {
        // Stepping down needs no permission, but nobody promotes themselves.
        return if ranks_below(new_role, actor.role) {
            Ok(())
        } else {
            Err(AppError::forbidden("You can only lower your own role."))
        };
    }

    if !actor.can_moderate_members {
        return Err(AppError::forbidden("Insufficient permissions."));
    }

    if !ranks_below(target.role, actor.role) {
        return Err(AppError::forbidden(
            "You can only change the role of members below your own role.",
        ));
    }

    if !ranks_below(new_role, actor.role) {
        return Err(AppError::forbidden(
            "You can only assign roles below your own role.",
        ));
    }

    Ok(())
}

pub fn ensure_can_transfer_ownership(actor: Actor, target: Target) -> AppResult<()> {
    if !actor.has_owner_rights {
        return Err(AppError::forbidden(
            "Only the owner or a superadmin can transfer ownership.",
        ));
    }

    if target.role == MemberRole::Owner {
        return Err(AppError::bad_request("This member already owns the group."));
    }

    Ok(())
}

/// Every role the actor could move the target to, owner included when the
/// actor may transfer ownership. The target's current role is left out.
pub fn assignable_roles(actor: Actor, target: Target) -> Vec<MemberRole> {
    let transferable = ensure_can_transfer_ownership(actor, target)
        .is_ok()
        .then_some(MemberRole::Owner);

    let assignable = [Role::Admin, Role::Moderator, Role::User]
        .into_iter()
        .filter(|&role| ensure_can_change_role(actor, target, role).is_ok())
        .filter_map(|role| assignable(role).ok());

    transferable
        .into_iter()
        .chain(assignable)
        .filter(|&role| role != target.role)
        .collect()
}

/// Muting and unmuting follow the same rules. Only members with the user role
/// can be muted, so a muted member never holds moderation rights.
pub fn ensure_can_mute(actor: Actor, target: Target) -> AppResult<()> {
    if actor.user_id == target.user_id {
        return Err(AppError::bad_request("You cannot mute yourself."));
    }

    if target.role != MemberRole::User {
        return Err(AppError::bad_request(
            "Only members with the user role can be muted.",
        ));
    }

    if actor.has_owner_rights {
        return Ok(());
    }

    if !actor.can_moderate_members || !ranks_below(target.role, actor.role) {
        return Err(AppError::forbidden("Insufficient permissions."));
    }

    Ok(())
}

pub fn ensure_can_remove(actor: Actor, target: Target) -> AppResult<()> {
    if actor.user_id == target.user_id {
        return Err(AppError::bad_request(
            "You cannot remove yourself. Leave the group instead.",
        ));
    }

    if target.role == MemberRole::Owner {
        return Err(AppError::forbidden("The group owner cannot be removed."));
    }

    if actor.has_owner_rights {
        return Ok(());
    }

    if !actor.can_moderate_members {
        return Err(AppError::forbidden("Insufficient permissions."));
    }

    if !ranks_below(target.role, actor.role) {
        return Err(AppError::forbidden(
            "You can only remove members below your own role.",
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const ACTOR_ID: Uuid = Uuid::from_u128(1);
    const TARGET_ID: Uuid = Uuid::from_u128(2);

    fn member(role: MemberRole) -> Actor {
        Actor {
            user_id: ACTOR_ID,
            role,
            has_owner_rights: false,
            can_moderate_members: true,
        }
    }

    fn owner_rights(role: MemberRole) -> Actor {
        Actor {
            has_owner_rights: true,
            ..member(role)
        }
    }

    fn other(role: MemberRole) -> Target {
        Target {
            user_id: TARGET_ID,
            role,
        }
    }

    fn me(role: MemberRole) -> Target {
        Target {
            user_id: ACTOR_ID,
            role,
        }
    }

    #[test]
    fn owner_rights_assign_any_role_to_non_owners() {
        for actor in [
            owner_rights(MemberRole::Owner),
            owner_rights(MemberRole::Admin),
        ] {
            for target in [MemberRole::Admin, MemberRole::Moderator, MemberRole::User] {
                for role in [Role::Admin, Role::Moderator, Role::User] {
                    assert!(ensure_can_change_role(actor, other(target), role).is_ok());
                }
            }
        }
    }

    #[test]
    fn nobody_changes_the_owners_role() {
        assert!(
            ensure_can_change_role(
                owner_rights(MemberRole::Owner),
                me(MemberRole::Owner),
                Role::Admin
            )
            .is_err()
        );
        assert!(
            ensure_can_change_role(
                owner_rights(MemberRole::Admin),
                other(MemberRole::Owner),
                Role::Admin
            )
            .is_err()
        );
    }

    #[test]
    fn superadmin_member_may_change_own_role() {
        assert!(
            ensure_can_change_role(
                owner_rights(MemberRole::User),
                me(MemberRole::User),
                Role::Admin
            )
            .is_ok()
        );
    }

    #[test]
    fn admin_manages_only_lower_members_and_roles() {
        let admin = member(MemberRole::Admin);
        assert!(ensure_can_change_role(admin, other(MemberRole::User), Role::Moderator).is_ok());
        assert!(ensure_can_change_role(admin, other(MemberRole::Moderator), Role::User).is_ok());
        assert!(ensure_can_change_role(admin, other(MemberRole::User), Role::Admin).is_err());
        assert!(ensure_can_change_role(admin, other(MemberRole::Admin), Role::User).is_err());
    }

    #[test]
    fn moderator_cannot_create_or_demote_peers() {
        let moderator = member(MemberRole::Moderator);
        assert!(
            ensure_can_change_role(moderator, other(MemberRole::User), Role::Moderator).is_err()
        );
        assert!(
            ensure_can_change_role(moderator, other(MemberRole::Moderator), Role::User).is_err()
        );
    }

    #[test]
    fn members_may_step_down_but_never_up() {
        let admin = member(MemberRole::Admin);
        assert!(ensure_can_change_role(admin, me(MemberRole::Admin), Role::Moderator).is_ok());
        assert!(ensure_can_change_role(admin, me(MemberRole::Admin), Role::User).is_ok());
        assert!(ensure_can_change_role(admin, me(MemberRole::Admin), Role::Admin).is_err());

        let moderator = member(MemberRole::Moderator);
        assert!(ensure_can_change_role(moderator, me(MemberRole::Moderator), Role::User).is_ok());
        assert!(ensure_can_change_role(moderator, me(MemberRole::Moderator), Role::Admin).is_err());

        let user = member(MemberRole::User);
        assert!(ensure_can_change_role(user, me(MemberRole::User), Role::Moderator).is_err());
    }

    #[test]
    fn stepping_down_needs_no_moderation_permission() {
        let admin = Actor {
            can_moderate_members: false,
            ..member(MemberRole::Admin)
        };
        assert!(ensure_can_change_role(admin, me(MemberRole::Admin), Role::User).is_ok());
        assert!(ensure_can_change_role(admin, other(MemberRole::User), Role::Moderator).is_err());
    }

    #[test]
    fn superadmin_role_is_never_assignable() {
        assert!(
            ensure_can_change_role(
                owner_rights(MemberRole::Owner),
                other(MemberRole::User),
                Role::Superadmin
            )
            .is_err()
        );
    }

    #[test]
    fn removal_follows_the_same_hierarchy() {
        let admin = member(MemberRole::Admin);
        assert!(ensure_can_remove(admin, other(MemberRole::Moderator)).is_ok());
        assert!(ensure_can_remove(admin, other(MemberRole::Admin)).is_err());

        let moderator = member(MemberRole::Moderator);
        assert!(ensure_can_remove(moderator, other(MemberRole::User)).is_ok());
        assert!(ensure_can_remove(moderator, other(MemberRole::Moderator)).is_err());

        let without_permission = Actor {
            can_moderate_members: false,
            ..admin
        };
        assert!(ensure_can_remove(without_permission, other(MemberRole::User)).is_err());
    }

    #[test]
    fn moderators_mute_only_users() {
        let moderator = member(MemberRole::Moderator);
        assert!(ensure_can_mute(moderator, other(MemberRole::User)).is_ok());
        assert!(ensure_can_mute(moderator, other(MemberRole::Moderator)).is_err());

        let admin = member(MemberRole::Admin);
        assert!(ensure_can_mute(admin, other(MemberRole::User)).is_ok());
        assert!(ensure_can_mute(admin, other(MemberRole::Moderator)).is_err());

        let owner = owner_rights(MemberRole::Owner);
        assert!(ensure_can_mute(owner, other(MemberRole::User)).is_ok());
        assert!(ensure_can_mute(owner, other(MemberRole::Admin)).is_err());
        assert!(ensure_can_mute(owner, other(MemberRole::Owner)).is_err());
    }

    #[test]
    fn muting_needs_the_moderation_permission() {
        let without_permission = Actor {
            can_moderate_members: false,
            ..member(MemberRole::Admin)
        };
        assert!(ensure_can_mute(without_permission, other(MemberRole::User)).is_err());

        let user = Actor {
            can_moderate_members: true,
            ..member(MemberRole::User)
        };
        assert!(ensure_can_mute(user, other(MemberRole::User)).is_err());
    }

    #[test]
    fn nobody_mutes_themselves() {
        assert!(ensure_can_mute(owner_rights(MemberRole::User), me(MemberRole::User)).is_err());
    }

    #[test]
    fn caller_resolution_follows_owner_superadmin_and_permissions() {
        let caller = Caller {
            user_id: ACTOR_ID,
            is_superadmin: false,
            moderate_members_role: Role::Moderator,
        };

        let owner = caller.resolve(ACTOR_ID, Some(Role::Admin));
        assert_eq!(owner.role, MemberRole::Owner);
        assert!(owner.has_owner_rights);

        let moderator = caller.resolve(TARGET_ID, Some(Role::Moderator));
        assert!(!moderator.has_owner_rights);
        assert!(moderator.can_moderate_members);

        let user = caller.resolve(TARGET_ID, Some(Role::User));
        assert!(!user.can_moderate_members);

        let outside_superadmin = Caller {
            is_superadmin: true,
            ..caller
        }
        .resolve(TARGET_ID, None);
        assert!(outside_superadmin.has_owner_rights);
        assert!(outside_superadmin.can_moderate_members);
    }

    #[test]
    fn only_owner_rights_transfer_ownership_to_non_owners() {
        assert!(
            ensure_can_transfer_ownership(owner_rights(MemberRole::Owner), other(MemberRole::User))
                .is_ok()
        );
        assert!(
            ensure_can_transfer_ownership(owner_rights(MemberRole::User), me(MemberRole::User))
                .is_ok()
        );
        assert!(
            ensure_can_transfer_ownership(
                owner_rights(MemberRole::Admin),
                other(MemberRole::Owner)
            )
            .is_err()
        );
        assert!(
            ensure_can_transfer_ownership(member(MemberRole::Admin), other(MemberRole::User))
                .is_err()
        );
    }

    #[test]
    fn assignable_roles_list_every_allowed_change() {
        assert_eq!(
            assignable_roles(owner_rights(MemberRole::Owner), other(MemberRole::Admin)),
            [MemberRole::Owner, MemberRole::Moderator, MemberRole::User]
        );
        assert_eq!(
            assignable_roles(member(MemberRole::Admin), other(MemberRole::User)),
            [MemberRole::Moderator]
        );
        assert_eq!(
            assignable_roles(member(MemberRole::Admin), me(MemberRole::Admin)),
            [MemberRole::Moderator, MemberRole::User]
        );
        assert!(
            assignable_roles(member(MemberRole::Moderator), other(MemberRole::User)).is_empty()
        );
        assert!(
            assignable_roles(owner_rights(MemberRole::Owner), me(MemberRole::Owner)).is_empty()
        );
    }

    #[test]
    fn owner_rights_remove_anyone_but_the_owner_and_themselves() {
        let actor = owner_rights(MemberRole::Owner);
        assert!(ensure_can_remove(actor, other(MemberRole::Admin)).is_ok());
        assert!(ensure_can_remove(actor, other(MemberRole::Owner)).is_err());
        assert!(ensure_can_remove(actor, me(MemberRole::Owner)).is_err());
    }
}
