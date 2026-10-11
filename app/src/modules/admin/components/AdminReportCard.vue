<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Trash2 } from '@lucide/vue';
import TaskPreview from '@/modules/tasks/components/TaskPreview.vue';
import { useAdminFormat } from '@/modules/admin/composables/useAdminFormat';
import type { AdminReport } from '@/modules/admin/types';

const props = defineProps<{
  report: AdminReport;
}>();

const emit = defineEmits<{
  (e: 'delete', id: string): void;
}>();

const { t } = useI18n();
const { getTypeLabel, getSubjectName, fmtDate } = useAdminFormat();

const isMessage = computed(() => props.report.reportType === 'message');

const title = computed(() => {
  const r = props.report;
  if (isMessage.value) {
    return r.messageSenderEmail
      ? t('admin.reports.message_by', { email: r.messageSenderEmail })
      : t('admin.reports.message_sender_deleted');
  }
  return r.itemTitle ?? '';
});

const body = computed(() =>
  isMessage.value ? props.report.messageContent : props.report.itemDescription,
);
</script>

<template>
  <TaskPreview
    :title="title"
    :description="body"
    :note="report.itemEditorNote"
    :attachments="report.itemAttachments"
  >
    <template #meta>
      <div
        class="text-on-ghost-muted text-base flex flex-wrap gap-x-1 items-center"
      >
        <span v-if="report.contentDeleted" class="text-danger font-bold">{{
          t('admin.reports.deleted')
        }}</span>
        <template v-if="!isMessage && report.itemType">
          <span v-if="report.contentDeleted">·</span>
          <span>{{ getTypeLabel(report.itemType) }}</span>
          <span>·</span>
          <span>{{
            getSubjectName(report.itemSubject, report.itemCourse)
          }}</span>
          <span>·</span>
          <span>{{ fmtDate(report.itemDueDate) }}</span>
          <template v-if="report.creatorEmail">
            <span>·</span>
            <span>{{ report.creatorEmail }}</span>
          </template>
        </template>
      </div>
    </template>

    <footer
      class="flex flex-col gap-2 pt-2 mt-2 border-t border-ghost-border text-base"
    >
      <div v-if="report.reason">
        <div class="text-on-ghost font-bold">
          {{ t('admin.reports.reason') }}
        </div>
        <div class="text-on-ghost-muted italic">"{{ report.reason }}"</div>
      </div>

      <div class="text-sm text-on-ghost-muted">
        {{
          t('admin.reports.from', {
            email: report.reporterEmail,
            date: fmtDate(report.reportedAt),
          })
        }}
      </div>

      <BaseRow>
        <BaseButton
          variant="ghost"
          :icon="Trash2"
          @click="emit('delete', report.id)"
        >
          {{ t('admin.reports.delete') }}
        </BaseButton>
      </BaseRow>
    </footer>
  </TaskPreview>
</template>
