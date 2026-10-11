<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { ListFilter } from '@lucide/vue';

withDefaults(
  defineProps<{
    show: boolean;
    /** Off for a page shown again, which should not replay its entrance. */
    entrance?: boolean;
  }>(),
  { entrance: true },
);

const emit = defineEmits<{ dismiss: [] }>();

const i18n = useI18n();
const t = i18n.t.bind(i18n);
const tm = i18n.tm.bind(i18n);
</script>

<template>
  <BaseNotice
    :show="show"
    :icon="ListFilter"
    :entrance="entrance"
    @dismiss="emit('dismiss')"
  >
    <span>{{ t('common.personalized_view.notice') }}</span>
    <BaseInfoButton
      :tooltip="t('common.personalized_view.info.tooltip')"
      :title="t('common.personalized_view.info.title')"
      :icon-size="16"
    >
      <p>{{ t('common.personalized_view.info.description') }}</p>
      <template
        v-for="(section, index) in tm('common.personalized_view.info.sections')"
        :key="index"
      >
        <h3>{{ section.title }}</h3>
        <p>{{ section.text }}</p>
      </template>
    </BaseInfoButton>
  </BaseNotice>
</template>
