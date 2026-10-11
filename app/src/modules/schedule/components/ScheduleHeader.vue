<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps<{
  loading: boolean;
  isPersonalized: boolean;
}>();

const i18n = useI18n();
const t = i18n.t.bind(i18n);
const tm = i18n.tm.bind(i18n);
</script>

<template>
  <BasePageHeader>
    <template #info>
      <BaseInfoButton
        :tooltip="t('schedule.infopop.tooltip')"
        :title="t('schedule.title')"
      >
        <p>
          {{ t('schedule.infopop.description') }}
        </p>
        <div
          v-for="(section, index) in tm('schedule.infopop.sections')"
          :key="index"
          class="mb-4"
        >
          <h3 v-html="section.title"></h3>
          <p v-html="section.text"></p>
        </div>
        <div class="w-full flex items-center justify-center mt-4">
          <img
            :alt="t('common.image')"
            src="https://res.cloudinary.com/dwysdpvcm/image/upload/v1765474359/Stundenplan_Ausfall_Grafik_b34pcq.webp"
            class="w-full h-full rounded-lg"
          />
        </div>
      </BaseInfoButton>
    </template>
    <template #action>
      <slot name="action"></slot>
    </template>
  </BasePageHeader>
</template>
