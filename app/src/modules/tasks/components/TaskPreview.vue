<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { StoredFile } from '@/api/files';
import TaskAttachmentThumbnail from './TaskAttachmentThumbnail.vue';
import TaskDescription from './TaskDescription.vue';

defineProps<{
  title: string;
  description?: string;
  note?: string;
  attachments?: StoredFile[];
}>();

defineSlots<{
  meta?(): unknown;
  default?(): unknown;
}>();

const { t } = useI18n();
</script>

<!-- A task shown in full for reference outside the task pages, such as in
     reports or as the duplicate a new task may repeat. Nothing in it reacts,
     so it can sit inside any dialog or list. -->
<template>
  <article class="flex flex-col cursor-default">
    <header class="flex flex-col gap-1 mb-3">
      <h3
        class="min-w-0 text-lg/6! overflow-hidden text-ellipsis whitespace-nowrap -my-0.75!"
        :title="title"
      >
        {{ title }}
      </h3>
      <slot name="meta" />
    </header>

    <section
      v-if="note"
      class="text-on-ghost text-base pb-2 mb-2 border-b border-ghost-border"
    >
      <div class="font-bold">{{ t('tasks.list.notes.note') }}</div>
      <!-- prettier-ignore -->
      <div class="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{{ note }}</div>
    </section>

    <TaskDescription
      v-if="description"
      class="select-text"
      :description="description"
    />

    <!-- Columns follow the room the card gets, like the task's own grid. -->
    <div v-if="attachments?.length" class="@container mt-2">
      <div class="grid grid-cols-3 gap-1 @md:grid-cols-4">
        <div
          v-for="file in attachments"
          :key="file.publicId"
          class="aspect-square overflow-hidden rounded-sm bg-black/[0.12]"
        >
          <TaskAttachmentThumbnail :file="file" />
        </div>
      </div>
    </div>

    <slot />
  </article>
</template>
