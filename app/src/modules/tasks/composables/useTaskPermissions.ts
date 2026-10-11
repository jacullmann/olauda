import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { storeToRefs } from 'pinia';
import { useGroups } from '@/modules/groups/composables/useGroups';
import { useUserStore } from '@/modules/account/stores/useUserStore';
import type { Attachment, Task } from '@/modules/tasks/types';
import type { PermissionKey } from '@/modules/groups/types';

type OwnedBy = { createdBy?: string | null };

/**
 * Mirrors the server's rules for the tasks of one group, so the UI only offers
 * what the server accepts. Own tasks stay editable and deletable whatever the
 * group's matrix says; owners and superadmins arrive with every permission.
 */
export function useTaskPermissions(groupId: MaybeRefOrGetter<string>) {
  const { findGroup } = useGroups();
  const { user } = storeToRefs(useUserStore());

  const permissions = computed(
    () =>
      new Set<PermissionKey>(
        findGroup(toValue(groupId))?.effectivePermissions ?? [],
      ),
  );

  const can = (permission: PermissionKey) => permissions.value.has(permission);

  const isOwn = ({ createdBy }: OwnedBy) =>
    !!user.value && !!createdBy && createdBy === user.value.id;

  const canUploadImages = computed(() => can('upload_images'));
  const canManageNotes = computed(() => can('manage_notes'));

  const canEdit = (item: Pick<Task, 'createdBy'>) =>
    isOwn(item) || can('edit_other_content');

  const canDelete = (item: Pick<Task, 'createdBy'>) =>
    isOwn(item) || can('delete_other_content');

  const canDeleteImage = (
    item: Pick<Task, 'createdBy'>,
    image: Pick<Attachment, 'createdBy'>,
  ) => isOwn(item) || isOwn(image) || can('delete_other_content');

  return {
    canUploadImages,
    canManageNotes,
    canEdit,
    canDelete,
    canDeleteImage,
  };
}

export type TaskPermissions = ReturnType<typeof useTaskPermissions>;
