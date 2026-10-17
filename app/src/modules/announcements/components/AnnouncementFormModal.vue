<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useMutation, useQueryClient } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { useI18n } from 'vue-i18n';
import { apiErrorMessage } from '@/api/errors';
import type { CreateAnnouncementDto } from '@/api/schema';
import { useGroups } from '@/modules/groups/composables/useGroups';
import GroupSelect from '@/modules/groups/components/GroupSelect.vue';
import { ANNOUNCEMENT_MAX_CHARS } from '@/modules/announcements/types';
import { groupKeys } from '@/modules/groups/utils/groupQueries';

const { t } = useI18n();

const props = defineProps<{
  groupId: string;
  local?: boolean;
  open: boolean;
}>();

const emit = defineEmits<{
  (e: 'cancel'): void;
  (e: 'success'): void;
}>();

const { userGroups } = useGroups();
const groupId = ref(props.groupId);

const annContent = ref('');
const annImportant = ref(false);

const queryClient = useQueryClient();
const publish = useMutation({
  mutationFn: ({
    target,
    body,
  }: {
    target: string;
    body: CreateAnnouncementDto;
  }) =>
    unwrap(
      api.POST('/groups/{group_id}/admin/announcements', {
        params: { path: { group_id: target } },
        body,
      }),
    ),
  onSuccess: (_, { target }) =>
    queryClient.invalidateQueries({
      queryKey: groupKeys.topic(target, 'announcements'),
    }),
});
const submitting = publish.isPending;

const contentError = ref('');
const submitError = ref('');

const contentInputRef = ref<{ focus: () => void } | null>(null);

onMounted(() => {
  contentInputRef.value?.focus();
});

async function submit() {
  contentError.value = '';
  submitError.value = '';

  if (!annContent.value.trim()) {
    contentError.value = t('announcements.form.errors.text_missing');
    return;
  }
  if (annContent.value.trim().length > ANNOUNCEMENT_MAX_CHARS) {
    contentError.value = t('announcements.form.errors.text_too_long', {
      max: ANNOUNCEMENT_MAX_CHARS,
    });
    return;
  }

  try {
    await publish.mutateAsync({
      target: groupId.value,
      body: { content: annContent.value.trim(), important: annImportant.value },
    });
    emit('success');
  } catch (e: unknown) {
    submitError.value = apiErrorMessage(e, t('announcements.errors.publish'));
  }
}
</script>

<template>
  <BaseModal
    :open="open"
    :submit="submit"
    :loading="submitting"
    header-actions
    @cancel="$emit('cancel')"
  >
    <template #title>
      <span class="flex items-center gap-2 min-w-0">
        <span class="shrink-0">{{ t('announcements.form.title') }}</span>
        <GroupSelect
          v-if="userGroups.length > 1 && !local"
          v-model="groupId"
          permission="manage_announcements"
        />
      </span>
    </template>

    <template #content>
      <BaseFormContent :error="submitError">
        <BaseFormGroup id="announcement-content-input" :error="contentError">
          <BaseLabel for="announcement-content-input" required>{{
            t('announcements.form.content_label')
          }}</BaseLabel>
          <BaseInput
            id="announcement-content-input"
            ref="contentInputRef"
            v-model="annContent"
            :placeholder="t('announcements.form.content_placeholder')"
            :maxlength="ANNOUNCEMENT_MAX_CHARS"
            :aria-describedby="
              contentError ? 'announcement-content-input-error' : undefined
            "
          />
        </BaseFormGroup>

        <BaseSwitchRow
          v-model="annImportant"
          :label="t('announcements.form.important_label')"
        />
      </BaseFormContent>
    </template>

    <template #action-text>
      {{ t('common.buttons.add') }}
    </template>
  </BaseModal>
</template>
