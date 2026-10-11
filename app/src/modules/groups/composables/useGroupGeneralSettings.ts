import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/client';
import { groupPath } from '@/api/groupPath';
import { apiErrorMessage } from '@/api/errors';
import { useToast } from '@/common/composables/useToast';
import { useGroupPageId } from './useGroupPageId';
import { useSession } from '@/modules/auth/composables/useSession';
import { useGroups } from './useGroups';
import type { GroupType } from '@/modules/groups/types';

interface GroupSettingsPatch {
  name?: string;
  avatarId?: string | null;
  groupType?: GroupType;
  daltonEnabled?: boolean;
}

/** The group's name, picture, type and Dalton setting, and deleting it. */
export function useGroupGeneralSettings() {
  const groupId = useGroupPageId();
  const { t } = useI18n();
  const toast = useToast();
  const { groupName: authGroupName } = useGroups();
  const { checkAuthStatus } = useSession();

  const groupName = computed(
    () => authGroupName.value || t('groups.settings.group_fallback'),
  );
  const editingGroupName = ref(false);
  const newGroupName = ref('');
  const savingGroupName = ref(false);
  const savingGroupType = ref(false);
  const savingDaltonEnabled = ref(false);

  async function patchSettings(patch: GroupSettingsPatch) {
    await api.patch(groupPath(groupId, '/admin/settings'), patch);
    await checkAuthStatus();
  }

  function startEditGroupName() {
    newGroupName.value = groupName.value;
    editingGroupName.value = true;
  }

  function cancelEditGroupName() {
    editingGroupName.value = false;
    newGroupName.value = '';
  }

  async function saveGroupName() {
    const name = newGroupName.value.trim();
    if (!name) return;
    savingGroupName.value = true;
    try {
      await api.patch(groupPath(groupId, '/admin/settings'), { name });
      editingGroupName.value = false;
      await checkAuthStatus();
    } catch (e) {
      toast.error(
        apiErrorMessage(e, t('groups.settings.general.errors.save_name')),
      );
    } finally {
      savingGroupName.value = false;
    }
  }

  /** `avatarId` names an upload from `uploadGroupAvatar`; `null` removes the picture. */
  async function saveGroupAvatar(avatarId: string | null): Promise<boolean> {
    try {
      await patchSettings({ avatarId });
      return true;
    } catch (e) {
      toast.error(
        apiErrorMessage(
          e,
          avatarId
            ? t('groups.settings.general.avatar.errors.save')
            : t('groups.settings.general.avatar.errors.delete'),
        ),
      );
      return false;
    }
  }

  async function saveGroupType(groupType: GroupType): Promise<boolean> {
    savingGroupType.value = true;
    try {
      await patchSettings({ groupType });
      return true;
    } catch (e) {
      toast.error(
        apiErrorMessage(e, t('groups.settings.general.errors.save_group_type')),
      );
      return false;
    } finally {
      savingGroupType.value = false;
    }
  }

  async function saveDaltonEnabled(daltonEnabled: boolean): Promise<boolean> {
    savingDaltonEnabled.value = true;
    try {
      await patchSettings({ daltonEnabled });
      return true;
    } catch (e) {
      toast.error(
        apiErrorMessage(e, t('groups.settings.general.errors.save_dalton')),
      );
      return false;
    } finally {
      savingDaltonEnabled.value = false;
    }
  }

  async function deleteGroup(): Promise<boolean> {
    try {
      await api.delete(groupPath(groupId));
      toast.success(t('groups.success.delete'));
      return true;
    } catch (e) {
      toast.error(apiErrorMessage(e, t('groups.errors.delete')));
      return false;
    }
  }

  return {
    groupName,
    editingGroupName,
    newGroupName,
    savingGroupName,
    startEditGroupName,
    cancelEditGroupName,
    saveGroupName,
    saveGroupAvatar,
    savingGroupType,
    saveGroupType,
    savingDaltonEnabled,
    saveDaltonEnabled,
    deleteGroup,
  };
}
