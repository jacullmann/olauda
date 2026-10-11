<script setup lang="ts">
import { computed, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { Check } from '@lucide/vue';
import { GROUP_TYPES, type GroupType } from '@/modules/groups/types';

defineProps<{
  disabled?: boolean;
}>();

const groupType = defineModel<GroupType>({ required: true });

const { t } = useI18n();
const radioName = useId();

const groupTypeOptions = computed(() =>
  GROUP_TYPES.map((type) => ({
    value: type,
    title: t(`groups.settings.general.group_type.options.${type}.title`),
    description: t(
      `groups.settings.general.group_type.options.${type}.description`,
    ),
  })),
);
</script>

<template>
  <fieldset class="flex flex-col w-full" :disabled="disabled">
    <legend class="block text-on-ghost-muted text-sm mb-1.5">
      {{ t('groups.settings.general.group_type.label') }}
    </legend>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label
        v-for="option in groupTypeOptions"
        :key="option.value"
        class="relative flex flex-col gap-0.5 rounded-2xl border bg-surface p-4 pr-10 select-none transition-[border-color,background-color,box-shadow,opacity] duration-200 ease-out has-[:focus-visible]:shadow-focus-ring"
        :class="[
          groupType === option.value
            ? 'checkbox-checked border-action ring-1 ring-action'
            : 'border-ghost-border',
          disabled
            ? 'cursor-not-allowed opacity-60'
            : 'cursor-pointer hover:bg-surface-highlight',
        ]"
      >
        <input
          v-model="groupType"
          type="radio"
          :name="radioName"
          :value="option.value"
          class="sr-only"
        />
        <!-- Concentric with the card's corner arc: its radius, minus the
             card border, minus half the indicator. -->
        <span
          class="absolute [--check-inset:calc(var(--radius-2xl)-1px-var(--spacing)*2.5)] top-(--check-inset) right-(--check-inset) size-5 rounded-full border border-ghost-border"
          aria-hidden="true"
        >
          <span
            class="absolute -inset-0.25 rounded-full bg-action flex items-center justify-center checkbox-bg-clip checkbox-bg-clip-round"
          >
            <Check
              class="text-on-action check-animate"
              :size="12"
              stroke-width="3.5"
            />
          </span>
        </span>
        <span class="text-sm/[1.2] font-semibold text-on-ghost">
          {{ option.title }}
        </span>
        <span class="text-xs/[1.35] text-on-ghost-muted">
          {{ option.description }}
        </span>
      </label>
    </div>
  </fieldset>
</template>
