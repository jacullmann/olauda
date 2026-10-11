import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/api';
import { groupPath } from '@/api/groupPath';
import { useToast } from '@/common/composables/useToast';
import { useGroupPageId } from '@/core/composables/useGroupPageId';
import { useAppAuth } from '@/modules/auth/composables/useAppAuth';
import type { BannedMember } from '@/modules/groups/types';

/** Former members banned from rejoining the group. */
export function useGroupBans() {
  const groupId = useGroupPageId();
  const { t } = useI18n();
  const toast = useToast();
  const { checkPermission } = useAppAuth();

  const bannedUsers = ref<BannedMember[]>([]);
  const loadingBannedUsers = ref(false);

  async function loadBannedUsers() {
    if (!checkPermission('moderate_members')) return;
    loadingBannedUsers.value = true;
    try {
      const { data } = await api.get<BannedMember[]>(
        groupPath(groupId, '/admin/banned-users'),
      );
      bannedUsers.value = data;
    } catch {
      toast.error(t('groups.settings.members.errors.load_banned'));
    } finally {
      loadingBannedUsers.value = false;
    }
  }

  async function revertBan(userId: string) {
    try {
      await api.delete(groupPath(groupId, `/admin/banned-users/${userId}`));
      bannedUsers.value = bannedUsers.value.filter((u) => u.userId !== userId);
    } catch {
      toast.error(t('groups.settings.members.errors.unban'));
    }
  }

  onMounted(loadBannedUsers);

  return { bannedUsers, loadingBannedUsers, revertBan };
}
