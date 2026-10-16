use crate::{
    common::{extractors::TenantContext, permission::Permission},
    error::AppResult,
};
use uuid::Uuid;

/// What the caller may do to the tasks of a group. Own tasks stay editable and
/// deletable whatever the group's matrix says; everyone else's depend on it.
/// A muted member gets no actor at all, so their own tasks are read-only too.
#[derive(Debug, Clone, Copy)]
pub struct ItemActor {
    pub user_id: Uuid,
    pub can_edit_others: bool,
    pub can_delete_others: bool,
    pub can_attach_files: bool,
}

impl ItemActor {
    pub fn from_context(tc: &TenantContext) -> AppResult<Self> {
        tc.ensure_not_muted()?;
        Ok(Self {
            user_id: tc.user.user_id,
            can_edit_others: tc.can(Permission::EditOtherContent),
            can_delete_others: tc.can(Permission::DeleteOtherContent),
            can_attach_files: tc.can(Permission::UploadImages),
        })
    }

    fn is(&self, user_id: Option<Uuid>) -> bool {
        user_id == Some(self.user_id)
    }

    pub fn may_edit(&self, item_creator: Option<Uuid>) -> bool {
        self.is(item_creator) || self.can_edit_others
    }

    pub fn may_delete(&self, item_creator: Option<Uuid>) -> bool {
        self.is(item_creator) || self.can_delete_others
    }

    pub fn may_remove_attachment(
        &self,
        item_creator: Option<Uuid>,
        uploader: Option<Uuid>,
    ) -> bool {
        self.is(item_creator) || self.is(uploader) || self.can_delete_others
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn member(user_id: Uuid) -> ItemActor {
        ItemActor {
            user_id,
            can_edit_others: false,
            can_delete_others: false,
            can_attach_files: false,
        }
    }

    #[test]
    fn creator_keeps_control_without_any_permission() {
        let me = Uuid::new_v4();
        let actor = member(me);
        assert!(actor.may_edit(Some(me)));
        assert!(actor.may_delete(Some(me)));
        assert!(actor.may_remove_attachment(Some(me), Some(Uuid::new_v4())));
    }

    #[test]
    fn plain_member_cannot_touch_foreign_tasks() {
        let actor = member(Uuid::new_v4());
        let other = Some(Uuid::new_v4());
        assert!(!actor.may_edit(other));
        assert!(!actor.may_delete(other));
        assert!(!actor.may_remove_attachment(other, other));
    }

    #[test]
    fn uploader_may_remove_own_attachment_on_foreign_task() {
        let me = Uuid::new_v4();
        let actor = member(me);
        assert!(actor.may_remove_attachment(Some(Uuid::new_v4()), Some(me)));
    }

    #[test]
    fn orphaned_tasks_belong_to_nobody() {
        let actor = member(Uuid::new_v4());
        assert!(!actor.may_edit(None));
        assert!(!actor.may_delete(None));
        assert!(!actor.may_remove_attachment(None, None));
    }

    #[test]
    fn permissions_open_foreign_tasks_independently() {
        let other = Some(Uuid::new_v4());
        let editor = ItemActor {
            can_edit_others: true,
            ..member(Uuid::new_v4())
        };
        assert!(editor.may_edit(other));
        assert!(!editor.may_delete(other));
        assert!(!editor.may_remove_attachment(other, other));

        let deleter = ItemActor {
            can_delete_others: true,
            ..member(Uuid::new_v4())
        };
        assert!(!deleter.may_edit(other));
        assert!(deleter.may_delete(other));
        assert!(deleter.may_remove_attachment(other, other));
    }
}
