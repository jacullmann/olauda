<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useDeleteAccount } from '@/modules/account/composables/useDeleteAccount';

const { t } = useI18n();

defineProps<{
  email: string;
  open: boolean;
}>();

const emit = defineEmits<{
  (e: 'cancel'): void;
  (e: 'deleted'): void;
  (e: 'error', msg: string): void;
}>();

const { understoodChecked, submitting, errorMsg, confirmDelete } =
  useDeleteAccount(emit);
</script>

<template>
  <BaseModal
    :open="open"
    :submit="confirmDelete"
    :loading="submitting"
    danger
    :requirement="understoodChecked"
    :error="errorMsg"
    @cancel="$emit('cancel')"
  >
    <template #title>
      {{ t('auth.delete_account.title') }}
    </template>

    <template #content>
      <div class="bg-danger-hover border border-danger rounded-xl px-3 py-2">
        <strong class="font-sans text-lg text-danger block mb-2">{{
          t('auth.delete_account.warn_box.title')
        }}</strong>
        <div class="text-sm text-on-ghost font-bold">
          {{ t('common.contact.email') }}: {{ email }}
        </div>
        <br />
        <!-- eslint-disable vue/no-v-html -- bundled translation markup, not user input -->
        <div
          class="text-sm/relaxed text-on-ghost"
          v-html="t('auth.delete_account.warn_box.text')"
        ></div>
        <!-- eslint-enable vue/no-v-html -->
      </div>

      <BaseCheckbox v-model="understoodChecked">
        {{ t('auth.delete_account.confirm') }}
      </BaseCheckbox>
    </template>

    <template #action-text>
      {{ t('common.buttons.delete') }}
    </template>
  </BaseModal>
</template>
