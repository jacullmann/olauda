<script setup lang="ts">
import { computed, h, ref, type FunctionalComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import { Plus, RotateCcw } from '@lucide/vue';
import type { NavItem } from '@/common/components/BaseTabs.vue';
import {
  formatTimeOfDay,
  minutesSinceMidnight,
} from '@/common/utils/timeOfDay';
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
  newBreakSlot,
  reset,
  addBreak,
  setBreakMinutes,
  removeBreak,
  moveBreak,
  resetBreaksOn,
} = useScheduleConfigForm(scheduleConfig);

const TIME_STEP_MINS = 5;
const LATEST_START_MINS = 24 * 60 - TIME_STEP_MINS;
const MIN_LESSON_MINS = 10;
const MAX_LESSON_MINS = 120;

/** The day's settings, each with a stepper while they are being edited. */
const fields = computed(() => {
  const key = 'groups.settings.schedule.config';
  const config = isEditing.value ? form.value : scheduleConfig.value;
  return [
    {
      label: t(`${key}.start_time_label`),
      value: config.startTime,
      stepper: {
        modelValue: minutesSinceMidnight(config.startTime),
        min: 0,
        max: LATEST_START_MINS,
        step: TIME_STEP_MINS,
        decrementLabel: t(`${key}.earlier`),
        incrementLabel: t(`${key}.later`),
      },
      set: (minutes: number) => {
        form.value.startTime = formatTimeOfDay(minutes);
      },
    },
    {
      label: t(`${key}.slots_per_day_label`),
      value: String(config.totalSlots),
      stepper: {
        modelValue: config.totalSlots,
        min: 1,
        max: MAX_SLOTS,
        step: 1,
        decrementLabel: t(`${key}.fewer_slots`),
        incrementLabel: t(`${key}.more_slots`),
      },
      set: (slots: number) => {
        form.value.totalSlots = slots;
      },
    },
    {
      label: t(`${key}.lesson_length_label`),
      value: t(`${key}.minutes`, { minutes: config.lessonDurationMins }),
      stepper: {
        modelValue: config.lessonDurationMins,
        min: MIN_LESSON_MINS,
        max: MAX_LESSON_MINS,
        step: TIME_STEP_MINS,
        decrementLabel: t(`${key}.shorter`),
        incrementLabel: t(`${key}.longer`),
      },
      set: (minutes: number) => {
        form.value.lessonDurationMins = minutes;
      },
    },
  ];
});

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
const planTitle = computed(() =>
  t(
    isEditing.value
      ? 'groups.settings.schedule.config.breaks_title'
      : 'groups.settings.schedule.config.day_plan_title',
  ),
);
const shownTimes = computed(() =>
  isEditing.value ? draftConfig.value : scheduleConfig.value,
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
  <div class="@container">
    <BasePageHeader>
      {{ t('groups.settings.schedule.config.title') }}

      <template #action>
        <BaseButton
          v-if="canEdit && !isEditing"
          variant="ghost"
          @click="startEditing"
          >{{ t('common.buttons.edit') }}</BaseButton
        >
      </template>
    </BasePageHeader>

    <dl
      class="flex flex-col @lg:flex-row @lg:justify-between gap-x-8 gap-y-4 max-w-120 mt-4 mb-8"
    >
      <div
        v-for="{ label, value, stepper, set } in fields"
        :key="label"
        class="flex flex-col"
      >
        <dt class="text-sm text-on-ghost-muted">{{ label }}</dt>
        <dd
          class="m-0 flex items-center justify-between h-8.5 gap-2 whitespace-nowrap text-lg font-semibold tabular-nums text-on-ghost"
        >
          <span :aria-live="isEditing ? 'polite' : undefined">{{ value }}</span>
          <BaseInlineReveal :show="isEditing">
            <BaseStepper
              v-bind="stepper"
              :aria-label="label"
              @update:model-value="set"
            />
          </BaseInlineReveal>
        </dd>
      </div>
    </dl>

    <!-- One plan for both modes, so its controls come and go with editing. -->
    <div class="flex flex-col gap-6 max-w-120">
      <section class="flex flex-col gap-3" :aria-label="planTitle">
        <span class="text-sm font-medium text-on-ghost">{{ planTitle }}</span>

        <template v-if="isEditing">
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
            <BaseButton
              :icon="Plus"
              :disabled="newBreakSlot === null"
              @click="addBreak"
            >
              {{ t('groups.settings.schedule.config.add_break_button') }}
            </BaseButton>
          </div>
        </template>

        <template v-else-if="savedDaysWithOwnBreaks.length">
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
          :editable="isEditing"
          :times="shownTimes"
          :total-slots="shownTimes.totalSlots"
          :breaks="isEditing ? shownBreaks : savedBreaks"
          @set-minutes="setBreakMinutes"
          @remove="removeBreak"
          @move="moveBreak"
        />
      </section>

      <BaseRow
        v-if="isEditing"
        stack-on-mobile
        justify="end"
        class="w-full gap-2"
      >
        <BaseButton form variant="ghost" @click="stopEditing">
          {{ t('common.buttons.cancel') }}
        </BaseButton>
        <BaseButton form variant="action" :disabled="saving" @click="submit">
          {{ saving ? t('common.buttons.saving') : t('common.buttons.save') }}
        </BaseButton>
      </BaseRow>
    </div>
  </div>
</template>
