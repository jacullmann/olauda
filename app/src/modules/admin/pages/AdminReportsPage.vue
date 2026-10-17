<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import AdminReportCard from '@/modules/admin/components/AdminReportCard.vue';
import { useAdminReports } from '@/modules/admin/composables/useAdminReports';

const { reports, loadingReports, deleteReport } = useAdminReports();
const { t } = useI18n();
</script>

<template>
  <BasePageHeader>
    {{ t('admin.reports.title') }}
    <template v-if="reports.length" #info>
      <span
        class="text-on-ghost-muted bg-ghost-hover rounded-full text-sm font-semibold px-2.5 py-0.5"
        >{{ reports.length }}</span
      >
    </template>
  </BasePageHeader>

  <div v-if="loadingReports" class="flex justify-center p-10">
    <BaseSpinner on="ghost" size="24px" />
  </div>
  <div v-else-if="!reports.length" class="text-center text-on-ghost-muted p-10">
    {{ t('admin.reports.empty') }}
  </div>
  <div
    v-else
    class="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-x-8 gap-y-16"
  >
    <AdminReportCard
      v-for="r in reports"
      :key="r.id"
      :report="r"
      @delete="deleteReport"
    />
  </div>
</template>
