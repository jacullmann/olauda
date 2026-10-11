<script setup lang="ts">
import type { LogField } from '@/modules/admin/composables/useLogFormat';

defineProps<{
  fields: LogField[];
}>();
</script>

<template>
  <!-- The slot comes first, for the details an entry links somewhere. -->
  <dl
    v-if="fields.length || $slots.default"
    class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 mt-1 mb-0 text-sm"
  >
    <slot />
    <template v-for="field in fields" :key="field.key">
      <dt class="text-on-ghost-muted">{{ field.label }}</dt>
      <dd
        class="m-0 break-words"
        :class="{ 'font-mono text-xs/5 select-all break-all': field.isId }"
        :title="field.title"
      >
        {{ field.value }}
      </dd>
    </template>
  </dl>
</template>
