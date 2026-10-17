<script setup lang="ts">
import { computed } from 'vue';
import { Filter, LayoutGrid } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { usePersonalization } from '@/modules/account/composables/usePersonalization';
import { useUserStore } from '@/modules/account/stores/useUserStore';

const { t } = useI18n();
const userStore = useUserStore();
const { setPersonalization } = usePersonalization();

const dropdownValue = computed({
  get: () => ((userStore.user?.personalized ?? true) ? 'yes' : 'no'),
  set: (value: string) => {
    const personalized = value === 'yes';
    if (personalized !== userStore.user?.personalized) {
      void setPersonalization(personalized);
    }
  },
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
</script>

<template>
  <BaseMenuSelect
    v-model="dropdownValue"
    :options="options"
    :prefix="t('auth.settings.personalization')"
  />
</template>
