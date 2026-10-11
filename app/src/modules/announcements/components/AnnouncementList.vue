<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { formatDate } from '@/common/utils/formatDate';
import type { FeedAnnouncement } from '@/modules/announcements/types';
import { Megaphone } from '@lucide/vue';

defineProps<{
  announcements: FeedAnnouncement[];
}>();

defineSlots<{
  actions?(props: { announcement: FeedAnnouncement }): unknown;
}>();

const { t } = useI18n();
</script>

<template>
  <BaseEmptyState v-if="announcements.length === 0" :icon="Megaphone">
    {{ t('announcements.list.empty_state') }}
  </BaseEmptyState>
  <ul v-else class="flex flex-col">
    <template
      v-for="(ann, index) in announcements"
      :key="`${ann.scope}:${ann.id}`"
    >
      <li v-if="index > 0" role="presentation" class="separator"></li>
      <li class="flex flex-col gap-1 py-2">
        <div class="text-base text-on-ghost break-words">
          {{ ann.content }}
        </div>
        <div class="flex justify-between items-center gap-2">
          <div class="flex min-w-0 items-center gap-2 text-sm">
            <time :datetime="ann.publishedAt" class="text-on-ghost-muted">{{
              formatDate(ann.publishedAt, t)
            }}</time>
            <span v-if="ann.important" class="font-bold text-danger">
              {{ t('announcements.list.important') }}
            </span>
          </div>
          <slot name="actions" :announcement="ann"></slot>
        </div>
      </li>
    </template>
  </ul>
</template>
