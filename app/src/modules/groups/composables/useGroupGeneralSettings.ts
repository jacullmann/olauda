import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { apiErrorMessage } from '@/api/errors';
import type { GroupTopic, UpdateGroupSettingsDto } from '@/api/schema';
import { useToast } from '@/common/composables/useToast';
import { useGroupPageId } from './useGroupPageId';
import { useSession } from '@/modules/auth/composables/useSession';
import { useGroups } from './useGroups';
import type { GroupType } from '@/modules/groups/types';
import { groupKeys } from '@/modules/groups/utils/groupQueries';

/** The group's name, picture, type and Dalton setting, and deleting it. */
export function useGroupGeneralSettings() {
  const groupId = useGroupPageId();
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { groupName: authGroupName } = useGroups();
  const { checkAuthStatus } = useSession();

  const groupName = computed(
    () => authGroupName.value || t('groups.settings.group_fallback'),
  );
  const editingGroupName = ref(false);
  const newGroupName = ref('');

  // The session's group list carries every one of these settings.
  const settingsSave = () =>
    useMutation({
      mutationFn: (patch: UpdateGroupSettingsDto) =>
        unwrap(
          api.PATCH('/groups/{group_id}/admin/settings', {
            params: { path: { group_id: groupId } },
            body: patch,
          }),
        ),
      onSuccess: (_, patch) => {
        // Turning Dalton off deletes its lessons on the server.
        const topics: GroupTopic[] =
          patch.daltonEnabled === undefined
            ? ['settings']
            : ['settings', 'schedule'];
        return Promise.all([
          checkAuthStatus(),
          ...topics.map((topic) =>
            queryClient.invalidateQueries({
              queryKey: groupKeys.topic(groupId, topic),
            }),
          ),
        ]);
      },
    });

  // One per setting, so each knows whether its own save is still running.
  const saves: Record<
    keyof UpdateGroupSettingsDto,
    ReturnType<typeof settingsSave>
  > = {
    name: settingsSave(),
    avatarId: settingsSave(),
    groupType: settingsSave(),
    daltonEnabled: settingsSave(),
  };
  const savingGroupName = saves.name.isPending;
  const savingGroupType = saves.groupType.isPending;
  const savingDaltonEnabled = saves.daltonEnabled.isPending;

  /** Whether the change was saved; a failure is reported with `errorText`. */
  async function saveSettings<F extends keyof UpdateGroupSettingsDto>(
    field: F,
    value: UpdateGroupSettingsDto[F],
    errorText: string,
  ): Promise<boolean> {
    try {
      await saves[field].mutateAsync({ [field]: value });
      return true;
    } catch (e) {
      toast.error(apiErrorMessage(e, errorText));
      return false;
    }
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
    if (
      await saveSettings(
        'name',
        name,
        t('groups.settings.general.errors.save_name'),
      )
    ) {
      editingGroupName.value = false;
    }
  }

  /** `avatarId` names an upload from `uploadGroupAvatar`; `null` removes the picture. */
  function saveGroupAvatar(avatarId: string | null): Promise<boolean> {
    return saveSettings(
      'avatarId',
      avatarId,
      avatarId
        ? t('groups.settings.general.avatar.errors.save')
        : t('groups.settings.general.avatar.errors.delete'),
    );
  }

  function saveGroupType(groupType: GroupType): Promise<boolean> {
    return saveSettings(
      'groupType',
      groupType,
      t('groups.settings.general.errors.save_group_type'),
    );
  }

  function saveDaltonEnabled(daltonEnabled: boolean): Promise<boolean> {
    return saveSettings(
      'daltonEnabled',
      daltonEnabled,
      t('groups.settings.general.errors.save_dalton'),
    );
  }

  async function deleteGroup(): Promise<boolean> {
    try {
      await unwrap(
        api.DELETE('/groups/{group_id}', {
          params: { path: { group_id: groupId } },
        }),
      );
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
