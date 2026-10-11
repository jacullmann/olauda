<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { Download } from '@lucide/vue';
import { useDataExport } from '@/modules/auth/composables/useDataExport';

defineProps<{
  email: string;
}>();

const emit = defineEmits<{
  (e: 'deleteAccount'): void;
}>();

const { t } = useI18n();
const { exporting, downloadDataExport } = useDataExport();
</script>

<template>
  <div class="flex flex-col gap-10">
    <section class="flex flex-col gap-2">
      <h3>{{ t('auth.account_settings.account.email') }}</h3>
      <span class="text-base font-semibold text-on-ghost">{{ email }}</span>
    </section>

    <section class="flex flex-col gap-3 max-w-160">
      <h3>{{ t('auth.account_settings.data_export.title') }}</h3>
      <p class="text-sm/relaxed text-on-ghost-muted m-0!">
        {{ t('auth.account_settings.data_export.description') }}
      </p>
      <div>
        <BaseButton
          variant="action"
          :icon="Download"
          :loading="exporting"
          @click="downloadDataExport"
        >
          {{ t('auth.account_settings.data_export.download') }}
        </BaseButton>
      </div>
    </section>

    <section class="flex flex-col max-w-160">
      <h3 class="text-danger! mb-2!">
        {{ t('auth.account_settings.danger_zone.title') }}
      </h3>
      <p class="mt-0!">
        {{ t('auth.account_settings.danger_zone.description') }}
      </p>
      <div>
        <BaseButton form variant="danger" @click="emit('deleteAccount')">
          {{ t('auth.delete_account.title') }}
        </BaseButton>
      </div>
    </section>
  </div>
</template>
