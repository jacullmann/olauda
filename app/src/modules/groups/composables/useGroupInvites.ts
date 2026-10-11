import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/api';
import { groupPath } from '@/api/groupPath';
import { useToast } from '@/common/composables/useToast';
import { useGroupPageId } from '@/core/composables/useGroupPageId';
import { useAppAuth } from '@/modules/auth/composables/useAppAuth';
import type { GroupInviteLog } from '@/modules/groups/types';

/** The group's invite links, used, revoked and still open. */
export function useGroupInvites() {
  const groupId = useGroupPageId();
  const { t } = useI18n();
  const toast = useToast();
  const { checkPermission } = useAppAuth();

  const invites = ref<GroupInviteLog[]>([]);
  const loadingInvites = ref(false);

  async function loadInvites() {
    if (!checkPermission('moderate_members')) return;
    loadingInvites.value = true;
    try {
      const { data } = await api.get<GroupInviteLog[]>(
        groupPath(groupId, '/admin/invites'),
      );
      invites.value = data;
    } catch {
      toast.error(t('groups.settings.members.errors.load_invites'));
    } finally {
      loadingInvites.value = false;
    }
  }

  async function revokeInvite(id: string) {
    try {
      await api.delete(groupPath(groupId, `/admin/invites/${id}`));
      await loadInvites();
    } catch {
      toast.error(t('groups.settings.members.errors.revoke_invite'));
    }
  }

  onMounted(loadInvites);

  return { invites, loadingInvites, loadInvites, revokeInvite };
}
