<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { ANNOUNCEMENT_MAX_CHARS } from '@/modules/announcements/types';
import { isoDate } from '@/modules/schedule/utils/weekday';
import { useSystemAnnouncementForm } from '@/modules/admin/composables/useSystemAnnouncementForm';
import type { AdminSystemAnnouncement } from '@/modules/admin/types';

const props = defineProps<{
  open: boolean;
  /** Reschedules this one; otherwise posts a new one. */
  announcement: AdminSystemAnnouncement | null;
}>();

const emit = defineEmits<{
  (e: 'cancel'): void;
  (e: 'saved'): void;
}>();

const { t } = useI18n();
const { draft, fieldErrors, submitError, submitting, submit } =
  useSystemAnnouncementForm(props.announcement);

const today = isoDate(new Date());
const contentInput = useTemplateRef('contentInput');

onMounted(() => contentInput.value?.focus());

async function save() {
  if (await submit()) emit('saved');
}
</script>

<template>
  <BaseModal
    :open="open"
    :submit="save"
    :loading="submitting"
    header-actions
    @cancel="emit('cancel')"
  >
    <template #title>
      {{
        t(
          announcement
            ? 'admin.announcements.form.title_edit'
            : 'admin.announcements.form.title_create',
        )
      }}
    </template>

    <template #content>
      <BaseFormContent :error="submitError">
        <p class="text-sm text-on-ghost-muted m-0">
          {{ t('admin.announcements.form.audience_hint') }}
        </p>

        <BaseFormGroup
          id="system-announcement-content"
          :error="fieldErrors.content"
        >
          <BaseLabel for="system-announcement-content-input" required>{{
            t('admin.announcements.form.content_label')
          }}</BaseLabel>
          <BaseInput
            id="system-announcement-content-input"
            ref="contentInput"
            v-model="draft.content"
            :maxlength="ANNOUNCEMENT_MAX_CHARS"
            :aria-describedby="
              fieldErrors.content
                ? 'system-announcement-content-error'
                : undefined
            "
          />
        </BaseFormGroup>

        <BaseSwitchRow
          v-model="draft.important"
          :label="t('announcements.form.important_label')"
        />

        <BaseSwitchRow
          v-model="draft.scheduled"
          :label="t('admin.announcements.form.scheduled_label')"
        />
        <BaseFormGroup
          v-if="draft.scheduled"
          id="system-announcement-start"
          :error="fieldErrors.start"
        >
          <BaseLabel for="system-announcement-start-date">{{
            t('admin.announcements.form.start_label')
          }}</BaseLabel>
          <div class="flex flex-col gap-2 sm:flex-row">
            <div class="flex-1 min-w-0">
              <BaseDatePicker
                id="system-announcement-start-date"
                v-model="draft.startDate"
                :min="today"
              />
            </div>
            <div class="sm:w-32 sm:shrink-0">
              <BaseInput
                id="system-announcement-start-time"
                v-model="draft.startTime"
                type="time"
                :aria-label="t('admin.announcements.form.start_time_label')"
              />
            </div>
          </div>
        </BaseFormGroup>

        <BaseSwitchRow
          v-model="draft.expires"
          :label="t('admin.announcements.form.expires_label')"
        />
        <BaseFormGroup
          v-if="draft.expires"
          id="system-announcement-end"
          :error="fieldErrors.end"
        >
          <BaseLabel for="system-announcement-end-date">{{
            t('admin.announcements.form.end_label')
          }}</BaseLabel>
          <div class="flex flex-col gap-2 sm:flex-row">
            <div class="flex-1 min-w-0">
              <BaseDatePicker
                id="system-announcement-end-date"
                v-model="draft.endDate"
                :min="draft.scheduled ? draft.startDate : today"
              />
            </div>
            <div class="sm:w-32 sm:shrink-0">
              <BaseInput
                id="system-announcement-end-time"
                v-model="draft.endTime"
                type="time"
                :aria-label="t('admin.announcements.form.end_time_label')"
              />
            </div>
          </div>
        </BaseFormGroup>
      </BaseFormContent>
    </template>

    <template #action-text>
      {{
        announcement
          ? t('common.buttons.save')
          : t(
              draft.scheduled
                ? 'admin.announcements.form.schedule'
                : 'admin.announcements.form.publish',
            )
      }}
    </template>
  </BaseModal>
</template>
