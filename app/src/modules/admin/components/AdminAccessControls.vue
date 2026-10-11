<script setup lang="ts">
import { computed, onMounted, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAccessControls } from '@/modules/admin/composables/useAccessControls';
import type { AccessControlSwitch } from '@/modules/admin/types';

interface SwitchRow {
  name: AccessControlSwitch;
  id: string;
  on: boolean;
  /** Fixed by another switch rather than editable on its own. */
  locked: boolean;
  label: string;
  hint: string;
  note?: string;
}

const I18N_BASE = 'admin.overview.access_controls';

const { t } = useI18n();
const { controls, loading, saving, load, setSwitch } = useAccessControls();
const titleId = useId();
const registrationId = useId();
const shutdownId = useId();

const rows = computed<SwitchRow[]>(() => {
  const current = controls.value;
  if (!current) return [];
  return [
    {
      name: 'registrationPaused',
      id: registrationId,
      // Shutdown closes sign-ups without flipping the stored switch, so it
      // shows as on and locked while the stored setting waits for its end.
      on: current.registrationPaused || current.shutdown,
      locked: current.shutdown,
      label: t(`${I18N_BASE}.registration.label`),
      hint: t(`${I18N_BASE}.registration.hint`),
      note: current.shutdown ? t(`${I18N_BASE}.registration_held`) : undefined,
    },
    {
      name: 'shutdown',
      id: shutdownId,
      on: current.shutdown,
      locked: false,
      label: t(`${I18N_BASE}.shutdown.label`),
      hint: t(`${I18N_BASE}.shutdown.hint`),
    },
  ];
});

onMounted(load);
</script>

<template>
  <section class="flex flex-col gap-3" :aria-labelledby="titleId">
    <h3 :id="titleId">{{ t(`${I18N_BASE}.title`) }}</h3>

    <div
      class="rounded-xl border border-ghost-border bg-surface shadow-input p-4"
    >
      <div v-if="loading && !controls" class="flex justify-center p-4">
        <BaseSpinner on="ghost" size="20px" />
      </div>
      <div v-else-if="!controls" class="flex justify-center p-4">
        <BaseButton variant="ghost" @click="load">
          {{ t(`${I18N_BASE}.retry`) }}
        </BaseButton>
      </div>
      <template v-else>
        <ul>
          <li
            v-for="row in rows"
            :key="row.name"
            class="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0 border-b border-ghost-border last:border-b-0"
          >
            <div class="min-w-0">
              <label
                :for="row.id"
                class="font-semibold"
                :class="row.locked ? 'cursor-not-allowed' : 'cursor-pointer'"
              >
                {{ row.label }}
              </label>
              <p class="m-0! text-sm">{{ row.hint }}</p>
              <p v-if="row.note" class="mt-1! mb-0! text-sm font-semibold">
                {{ row.note }}
              </p>
            </div>
            <BaseToggle
              :id="row.id"
              :model-value="row.on"
              :disabled="row.locked || saving !== null"
              @update:model-value="(on: boolean) => setSwitch(row.name, on)"
            />
          </li>
        </ul>
      </template>
    </div>
  </section>
</template>
