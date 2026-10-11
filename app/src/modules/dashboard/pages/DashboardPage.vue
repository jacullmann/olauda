<script setup lang="ts">
import DashboardTagline from '@/modules/dashboard/components/DashboardTagline.vue';
import DashboardTasks from '@/modules/dashboard/components/DashboardTasks.vue';
import DashboardSchedule from '@/modules/dashboard/components/DashboardSchedule.vue';
import { usePageSettings } from '@/modules/account/composables/usePageSettings';

const { settings: dashboardSettings } = usePageSettings('dashboard');

const TASK_COUNT = 3;

/** Top to bottom: each section's header, then what it holds. */
const TASKS_ENTRANCE_ORDER = 1;
const SCHEDULE_ENTRANCE_ORDER = TASKS_ENTRANCE_ORDER + 1 + TASK_COUNT;
</script>

<template>
  <div class="p-4">
    <div class="relative mb-4 animate-enter">
      <DashboardTagline :show-quote="dashboardSettings.tagline" />
    </div>

    <div class="flex flex-col gap-8">
      <DashboardTasks
        :count="TASK_COUNT"
        :entrance-order="TASKS_ENTRANCE_ORDER"
      />
      <DashboardSchedule :entrance-order="SCHEDULE_ENTRANCE_ORDER" />
    </div>
  </div>
</template>
