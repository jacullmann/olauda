<script setup lang="ts">
import { provideTasks } from '@/modules/tasks/composables/useTasks';
import TaskDialogs from '@/modules/tasks/components/TaskDialogs.vue';

provideTasks();
</script>

<template>
  <BasePageStack root-page="TaskListPage" pushed-route="group-task" />

  <TaskDialogs />
</template>
