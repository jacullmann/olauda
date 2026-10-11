<script setup lang="ts">
import { computed } from 'vue';
import { Filter, LayoutGrid } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { usePersonalization } from '@/modules/account/composables/usePersonalization';

const { t } = useI18n();
const { setPersonalization: savePersonalization } = usePersonalization();

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'change', value: boolean): void;
}>();

const currentPersonalized = computed(() => props.modelValue);

const dropdownValue = computed({
  get: () => (currentPersonalized.value ? 'yes' : 'no'),
  set: (val: string) => void setPersonalization(val === 'yes'),
});

const options = computed(() => [
  {
    value: 'yes',
    label: t('auth.settings.personalization_options.mine'),
    icon: Filter,
  },
  {
    value: 'no',
    label: t('auth.settings.personalization_options.all'),
    icon: LayoutGrid,
  },
]);

async function setPersonalization(value: boolean) {
  if (value === currentPersonalized.value) return;

  emit('update:modelValue', value);
  const saved = await savePersonalization(value);
  if (saved === null) {
    emit('update:modelValue', !value);
    return;
  }

  emit('change', saved);
}
</script>

<template>
  <BaseMenuSelect
    v-model="dropdownValue"
    :options="options"
    :prefix="t('auth.settings.personalization')"
  />
</template>
