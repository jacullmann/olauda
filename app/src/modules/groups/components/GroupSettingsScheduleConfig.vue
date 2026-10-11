<script setup lang="ts">
import { computed, h, ref, type FunctionalComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import { Pencil, RotateCcw } from '@lucide/vue';
import type { NavItem } from '@/common/components/BaseTabs.vue';
import type { ScheduleConfig } from '@/modules/schedule/types';
import { useScheduleDisplay } from '@/modules/schedule/composables/useScheduleDisplay';
import { breaksOn } from '@/modules/schedule/utils/breaks';
import {
  MAX_SLOTS,
  useScheduleConfigForm,
} from '@/modules/groups/composables/useScheduleConfigForm';
import GroupSettingsScheduleDayPlan from './GroupSettingsScheduleDayPlan.vue';

const props = defineProps<{
  canEdit: boolean;
  saving: boolean;
  save: (config: ScheduleConfig) => Promise<boolean>;
}>();

const isEditing = defineModel<boolean>('editing', { default: false });

const { t, locale } = useI18n();
const { days, scheduleConfig, formatDayName } = useScheduleDisplay();

const {
  form,
  shownDay,
  draftConfig,
  daysWithOwnBreaks,
  shownBreaks,
  reset,
  addBreak,
  setBreakMinutes,
  removeBreak,
  moveBreak,
  resetBreaksOn,
} = useScheduleConfigForm(scheduleConfig);

const EVERYONE_TAB = 'everyone';

/** Marks a day with breaks of its own in the day tabs. */
const OwnBreaksDot: FunctionalComponent = () =>
  h('span', { class: 'size-1.5 mr-1.5 rounded-full bg-current' });

const dayTabsOf = (
  shownDays: readonly number[],
  ownDays: readonly number[],
  weekday: 'long' | 'short',
): NavItem[] => [
  {
    id: EVERYONE_TAB,
    label: t('groups.settings.schedule.config.everyone_tab'),
  },
  ...shownDays.map((day) => ({
    id: String(day),
    label: formatDayName(day, weekday),
    icon: ownDays.includes(day) ? OwnBreaksDot : undefined,
  })),
];

const tabIdOf = (day: number | null) =>
  day === null ? EVERYONE_TAB : String(day);
const dayOfTab = (id: string) => (id === EVERYONE_TAB ? null : Number(id));

const listFormat = computed(
  () => new Intl.ListFormat(locale.value, { type: 'conjunction' }),
);

/** Which days the breaks on show apply to. */
function breaksHint(config: ScheduleConfig, day: number | null) {
  const key = 'groups.settings.schedule.config';
  if (day !== null) {
    return config.dayBreaks[day]
      ? t(`${key}.day_has_own_breaks`, { day: formatDayName(day) })
      : t(`${key}.day_follows_everyone`, { day: formatDayName(day) });
  }
  const everyonesDays = days.filter((ownDay) => !config.dayBreaks[ownDay]);
  if (everyonesDays.length === days.length) return t(`${key}.every_day`);
  if (everyonesDays.length === 0) return t(`${key}.no_day`);
  return t(`${key}.only_days`, {
    days: listFormat.value.format(
      everyonesDays.map((everyonesDay) => formatDayName(everyonesDay)),
    ),
  });
}

const editTabs = computed(() =>
  dayTabsOf(days, daysWithOwnBreaks.value, 'short'),
);
const editHint = computed(() => breaksHint(draftConfig.value, shownDay.value));

const savedDaysWithOwnBreaks = computed(() =>
  days.filter((day) => scheduleConfig.value.dayBreaks[day]),
);
const savedShownDayChoice = ref<number | null>(null);
/** The day picked to look at, unless its own breaks have since gone. */
const savedShownDay = computed(() =>
  savedShownDayChoice.value !== null &&
  savedDaysWithOwnBreaks.value.includes(savedShownDayChoice.value)
    ? savedShownDayChoice.value
    : null,
);
const savedTabs = computed(() =>
  dayTabsOf(savedDaysWithOwnBreaks.value, [], 'long'),
);
const savedBreaks = computed(() =>
  savedShownDay.value === null
    ? scheduleConfig.value.breaks
    : breaksOn(scheduleConfig.value, savedShownDay.value),
);

function startEditing() {
  if (!props.canEdit) return;
  reset();
  shownDay.value = savedShownDay.value;
  isEditing.value = true;
}

function stopEditing() {
  isEditing.value = false;
}

async function submit() {
  if (await props.save(draftConfig.value)) stopEditing();
}
</script>

<template>
  <div>
    <BasePageHeader>
      {{ t('groups.settings.schedule.config.title') }}

      <template #action>
        <BaseTooltip
          v-if="canEdit && !isEditing"
          :content="t('groups.settings.schedule.config.edit_button')"
          placement="bottom"
        >
          <BaseButton variant="ghost" :icon="Pencil" @click="startEditing" />
        </BaseTooltip>
      </template>
    </BasePageHeader>

    <BaseFormContent v-if="isEditing" class="max-w-120">
      <BaseFormGroup id="config-start">
        <BaseLabel for="config-start-input">{{
          t('groups.settings.schedule.config.start_time_label')
        }}</BaseLabel>
        <BaseInput
          id="config-start-input"
          v-model="form.startTime"
          type="time"
        />
      </BaseFormGroup>
      <BaseFormGroup id="config-slots">
        <BaseLabel for="config-slots-input">{{
          t('groups.settings.schedule.config.slots_per_day_label')
        }}</BaseLabel>
        <BaseInput
          id="config-slots-input"
          v-model.number="form.totalSlots"
          type="number"
          min="1"
          :max="MAX_SLOTS"
        />
      </BaseFormGroup>
      <BaseFormGroup id="config-duration">
        <BaseLabel for="config-duration-input">{{
          t('groups.settings.schedule.config.lesson_duration_label')
        }}</BaseLabel>
        <BaseInput
          id="config-duration-input"
          v-model.number="form.lessonDurationMins"
          type="number"
          min="10"
          max="120"
        />
      </BaseFormGroup>

      <section
        class="flex flex-col gap-3 pt-4 border-t border-ghost-border"
        :aria-label="t('groups.settings.schedule.config.breaks_title')"
      >
        <span class="text-sm font-medium text-on-ghost">
          {{ t('groups.settings.schedule.config.breaks_title') }}
        </span>

        <BaseTabs
          :items="editTabs"
          :active-id="tabIdOf(shownDay)"
          @change="(id) => (shownDay = dayOfTab(id))"
        />

        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 min-h-8">
          <p class="m-0 flex-1 min-w-48 text-sm text-on-ghost-muted">
            {{ editHint }}
          </p>
          <BaseButton
            v-if="shownDay !== null && draftConfig.dayBreaks[shownDay]"
            :icon="RotateCcw"
            @click="resetBreaksOn(shownDay)"
          >
            {{ t('groups.settings.schedule.config.use_everyones_breaks') }}
          </BaseButton>
        </div>

        <GroupSettingsScheduleDayPlan
          editable
          :times="draftConfig"
          :total-slots="draftConfig.totalSlots"
          :breaks="shownBreaks"
          @add="addBreak"
          @set-minutes="setBreakMinutes"
          @remove="removeBreak"
          @move="moveBreak"
        />
      </section>

      <BaseRow stack-on-mobile justify="end" class="w-full mt-2 gap-2">
        <BaseButton form variant="ghost" @click="stopEditing">
          {{ t('common.buttons.cancel') }}
        </BaseButton>
        <BaseButton form variant="action" :disabled="saving" @click="submit">
          {{ saving ? t('common.buttons.saving') : t('common.buttons.save') }}
        </BaseButton>
      </BaseRow>
    </BaseFormContent>

    <div v-else class="flex flex-col max-w-120">
      <dl class="flex max-[400px]:flex-col gap-4 mt-4 mb-8">
        <div
          v-for="{ label, value } in [
            {
              label: t('groups.settings.schedule.config.start_time_label'),
              value: scheduleConfig.startTime,
            },
            {
              label: t('groups.settings.schedule.config.slots_per_day_label'),
              value: scheduleConfig.totalSlots,
            },
            {
              label: t('groups.settings.schedule.config.lesson_length_label'),
              value: t('groups.settings.schedule.config.minutes', {
                minutes: scheduleConfig.lessonDurationMins,
              }),
            },
          ]"
          :key="label"
          class="flex flex-col flex-1 min-w-0"
        >
          <dt class="text-sm text-on-ghost-muted">{{ label }}</dt>
          <dd class="m-0 text-lg font-semibold tabular-nums text-on-ghost">
            {{ value }}
          </dd>
        </div>
      </dl>

      <section
        class="flex flex-col gap-3"
        :aria-label="t('groups.settings.schedule.config.day_plan_title')"
      >
        <span class="text-sm font-medium text-on-ghost">
          {{ t('groups.settings.schedule.config.day_plan_title') }}
        </span>

        <template v-if="savedDaysWithOwnBreaks.length">
          <BaseTabs
            :items="savedTabs"
            :active-id="tabIdOf(savedShownDay)"
            @change="(id) => (savedShownDayChoice = dayOfTab(id))"
          />
          <p class="m-0 text-sm text-on-ghost-muted">
            {{ breaksHint(scheduleConfig, savedShownDay) }}
          </p>
        </template>

        <GroupSettingsScheduleDayPlan
          :times="scheduleConfig"
          :total-slots="scheduleConfig.totalSlots"
          :breaks="savedBreaks"
        />
      </section>
    </div>
  </div>
</template>
