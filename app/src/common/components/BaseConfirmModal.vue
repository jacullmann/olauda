<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

defineEmits<{
  confirm: [];
  cancel: [];
}>();

withDefaults(
  defineProps<{
    title: string;
    submitText?: string;
    loading?: boolean;
    danger?: boolean;
    open: boolean;
    /**
     * Opens the dialog above a fullscreen overlay such as the image viewer;
     * see BaseSheet's own `elevated`.
     */
    elevated?: boolean;
  }>(),
  {
    loading: false,
    danger: false,
    submitText: undefined,
    elevated: false,
  },
);
</script>

<template>
  <BaseModal
    :open="open"
    :elevated="elevated"
    :submit="() => $emit('confirm')"
    :loading="loading"
    :danger="danger"
    :close-button="false"
    @cancel="$emit('cancel')"
  >
    <template #title>{{ title }}</template>

    <template #content>
      <p class="m-0!"><slot></slot></p>
    </template>

    <template #action-text>{{
      submitText ?? t('common.buttons.confirm')
    }}</template>
  </BaseModal>
</template>
