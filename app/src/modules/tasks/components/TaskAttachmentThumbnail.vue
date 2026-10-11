<script setup lang="ts">
import { computed } from 'vue';
import { FileText, PieChart, Table } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { isPdf, previewUrl, type StoredFile } from '@/api/files';

const props = defineProps<{
  file: StoredFile;
}>();

const { t } = useI18n();

const DOCUMENT_BADGES = {
  docx: {
    label: 'DOCX',
    icon: FileText,
    background: 'from-blue-400 to-indigo-800',
  },
  pptx: {
    label: 'PPTX',
    icon: PieChart,
    background: 'from-orange-400 to-rose-700',
  },
  xlsx: {
    label: 'XLSX',
    icon: Table,
    background: 'from-lime-400 to-green-800',
  },
} as const;
const PDF_BADGE = { label: 'PDF', icon: FileText } as const;
const FALLBACK_BACKGROUND = 'from-gray-500 to-gray-700';

const preview = computed(() => previewUrl(props.file));
const documentBadge = computed(
  () =>
    DOCUMENT_BADGES[props.file.format as keyof typeof DOCUMENT_BADGES] ?? null,
);
const fileBadge = computed(() =>
  isPdf(props.file) ? PDF_BADGE : documentBadge.value,
);
</script>

<template>
  <span class="relative block h-full w-full select-none">
    <img
      v-if="preview"
      :src="preview"
      class="block h-full w-full object-cover [pointer-events:none]"
      loading="lazy"
      draggable="false"
      :alt="t('common.preview')"
    />
    <span
      v-else
      class="flex flex-col items-center justify-center w-full h-full text-white p-3 text-center bg-gradient-to-br"
      :class="documentBadge?.background ?? FALLBACK_BACKGROUND"
    >
      <component
        :is="fileBadge?.icon ?? FileText"
        :size="32"
        class="mb-1.5 drop-shadow-md opacity-90"
      />
      <span class="text-sm font-bold uppercase">{{ file.format }}</span>
      <span
        class="text-xs text-white opacity-75 max-w-full truncate px-1"
        :title="file.name ?? undefined"
        >{{ file.name || t('tasks.images.document') }}</span
      >
    </span>

    <span
      v-if="fileBadge && preview"
      class="absolute top-1 left-1 flex items-center gap-1.5 bg-black/40 border border-white/10 text-white p-1.5 pr-2 rounded-md text-sm/4 font-semibold pointer-events-none backdrop-blur-sm"
    >
      <component :is="fileBadge.icon" :size="16" class="text-white" />
      <span>{{ fileBadge.label }}</span>
    </span>
  </span>
</template>
