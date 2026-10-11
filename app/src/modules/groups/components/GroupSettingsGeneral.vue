<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useGroupGeneralSettings } from '@/modules/groups/composables/useGroupGeneralSettings';
import { useGroupSettingsAccess } from '@/modules/groups/composables/useGroupSettingsAccess';
import { useConfirmModal } from '@/shell/stores/useConfirmModal';
import { useSession } from '@/modules/auth/composables/useSession';
import { useGroups } from '@/modules/groups/composables/useGroups';
import GroupTypeRadioGroup from './GroupTypeRadioGroup.vue';
import GroupDeleteModal from './GroupDeleteModal.vue';
import type { GroupType } from '@/modules/groups/types';

const confirmModal = useConfirmModal();
const { t } = useI18n();
const { activeGroupType, checkPermission } = useGroups();
const { checkAuthStatus } = useSession();
const canEditGroupType = computed(() =>
  checkPermission('edit_group_configuration'),
);

const { hasOwnerRights } = useGroupSettingsAccess();
const { groupName, savingGroupType, saveGroupType, deleteGroup } =
  useGroupGeneralSettings();

const router = useRouter();

const groupTypeInput = ref<GroupType>(activeGroupType.value);

watch(activeGroupType, (type) => {
  groupTypeInput.value = type;
});

const groupTypeChanged = computed(
  () => groupTypeInput.value !== activeGroupType.value,
);

async function confirmGroupTypeChange() {
  if (!groupTypeChanged.value) return;

  const target = groupTypeInput.value;
  const isConfirmed = await confirmModal.ask({
    title: t('groups.settings.general.group_type.modal.title'),
    content: t(`groups.settings.general.group_type.modal.message_${target}`),
    submitText: t('common.buttons.save'),
  });

  if (!isConfirmed) {
    groupTypeInput.value = activeGroupType.value;
    return;
  }

  const ok = await saveGroupType(target);
  if (!ok) groupTypeInput.value = activeGroupType.value;
}

const deleteModalOpen = ref(false);
const deletingGroup = ref(false);

async function confirmDeleteGroup() {
  deletingGroup.value = true;
  if (!(await deleteGroup())) {
    deletingGroup.value = false;
    return;
  }

  deleteModalOpen.value = false;
  await checkAuthStatus();
  void router.push({ name: 'groups' });
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <div
      v-if="!canEditGroupType"
      class="text-center text-base text-on-ghost-muted"
    >
      <p class="m-0">{{ t('groups.settings.general.no_permission') }}</p>
    </div>

    <div>
      <BasePageHeader>{{
        t('groups.settings.general.group_type.title')
      }}</BasePageHeader>
      <p class="text-base/relaxed text-on-ghost-muted m-0 mb-4 max-w-160">
        {{ t('groups.settings.general.group_type.description') }}
      </p>

      <BaseFormContent class="max-w-120">
        <GroupTypeRadioGroup
          v-model="groupTypeInput"
          :disabled="!canEditGroupType || savingGroupType"
        />

        <BaseRow
          v-if="canEditGroupType"
          stack-on-mobile
          justify="end"
          class="w-full mt-2 gap-2"
        >
          <BaseButton
            form
            variant="ghost"
            :disabled="!groupTypeChanged || savingGroupType"
            @click="groupTypeInput = activeGroupType"
          >
            {{ t('common.buttons.cancel') }}
          </BaseButton>
          <BaseButton
            form
            variant="action"
            :disabled="!groupTypeChanged || savingGroupType"
            @click="confirmGroupTypeChange"
          >
            {{
              savingGroupType
                ? t('common.buttons.saving')
                : t('common.buttons.save')
            }}
          </BaseButton>
        </BaseRow>
      </BaseFormContent>
    </div>

    <div v-if="hasOwnerRights">
      <h3 class="text-danger! mb-2!">
        {{ t('groups.settings.general.delete_group.danger_zone_title') }}
      </h3>
      <p class="mt-0!">
        {{ t('groups.settings.general.delete_group.warning_text') }}
      </p>

      <BaseButton form variant="danger" @click="deleteModalOpen = true">
        {{ t('groups.settings.general.delete_group.button') }}
      </BaseButton>

      <GroupDeleteModal
        :open="deleteModalOpen"
        :group-name="groupName"
        :loading="deletingGroup"
        @cancel="deleteModalOpen = false"
        @confirm="confirmDeleteGroup"
      />
    </div>
  </div>
</template>
