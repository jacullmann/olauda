<script setup lang="ts">
const search = defineModel<string>('search', { required: true });

defineProps<{
  id: string;
  placeholder: string;
}>();
</script>

<template>
  <div class="flex flex-col sm:flex-row gap-2">
    <div class="w-full sm:max-w-sm">
      <BaseInput
        :id="id"
        v-model="search"
        type="search"
        :placeholder="placeholder"
        :aria-label="placeholder"
        autocomplete="off"
      />
    </div>
    <slot />
  </div>
</template>
