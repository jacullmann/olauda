<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowDown, ArrowUp, Coffee, Minus, Plus, Trash2 } from '@lucide/vue';
import type { ScheduleBreaks } from '@/modules/schedule/types';
import {
  formatMinuteRange,
  slotStartMinutesWith,
  type DayTimes,
} from '@/modules/schedule/utils/slotTimes';

const MAX_BREAK_MINS = 180;
const BREAK_STEP_MINS = 5;

const props = withDefaults(
  defineProps<{
    times: DayTimes;
    totalSlots: number;
    breaks: ScheduleBreaks;
    editable?: boolean;
  }>(),
  { editable: false },
);

const emit = defineEmits<{
  add: [afterSlot: number];
  setMinutes: [afterSlot: number, minutes: number];
  remove: [afterSlot: number];
  move: [afterSlot: number, toSlot: number];
}>();

const { t } = useI18n();

type PlanRow =
  | { kind: 'lesson'; slot: number; time: string }
  | {
      kind: 'break';
      afterSlot: number;
      minutes: number;
      time: string;
      earlierSlot: number | null;
      laterSlot: number | null;
    }
  | { kind: 'gap'; afterSlot: number };

/** Every lesson, and after each one but the last, its break or room for one. */
const rows = computed(() => {
  const { times, totalSlots, breaks } = props;
  const startOf = (slot: number) => slotStartMinutesWith(times, breaks, slot);
  const isFree = (slot: number) =>
    slot >= 1 && slot < totalSlots && !breaks[slot];

  const planRows: PlanRow[] = [];
  for (let slot = 1; slot <= totalSlots; slot++) {
    const start = startOf(slot);
    const end = start + times.lessonDurationMins;
    planRows.push({
      kind: 'lesson',
      slot,
      time: formatMinuteRange({ start, end }),
    });
    if (slot === totalSlots) break;

    const minutes = breaks[slot];
    if (minutes) {
      planRows.push({
        kind: 'break',
        afterSlot: slot,
        minutes,
        time: formatMinuteRange({ start: end, end: end + minutes }),
        earlierSlot: isFree(slot - 1) ? slot - 1 : null,
        laterSlot: isFree(slot + 1) ? slot + 1 : null,
      });
    } else if (props.editable) {
      planRows.push({ kind: 'gap', afterSlot: slot });
    }
  }
  return planRows;
});

function stepMinutes(afterSlot: number, minutes: number, direction: 1 | -1) {
  const stepped =
    direction === 1
      ? Math.floor(minutes / BREAK_STEP_MINS + 1) * BREAK_STEP_MINS
      : Math.ceil(minutes / BREAK_STEP_MINS - 1) * BREAK_STEP_MINS;
  emit(
    'setMinutes',
    afterSlot,
    Math.min(Math.max(stepped, BREAK_STEP_MINS), MAX_BREAK_MINS),
  );
}

const typedMinutes = (event: Event) =>
  Number((event.target as HTMLInputElement).value);

const isValidMinutes = (minutes: number) =>
  Number.isInteger(minutes) && minutes >= 1 && minutes <= MAX_BREAK_MINS;

function onMinutesInput(afterSlot: number, event: Event) {
  const minutes = typedMinutes(event);
  if (isValidMinutes(minutes)) emit('setMinutes', afterSlot, minutes);
}

/** A field left blank or out of range goes back to the break's length. */
function onMinutesChange(current: number, event: Event) {
  if (!isValidMinutes(typedMinutes(event))) {
    (event.target as HTMLInputElement).value = String(current);
  }
}
</script>

<template>
  <ol
    class="relative m-0 p-0 list-none before:absolute before:left-4 before:inset-y-5 before:w-px before:bg-ghost-border"
  >
    <li
      v-for="row in rows"
      :key="`${row.kind}-${'slot' in row ? row.slot : row.afterSlot}`"
    >
      <div
        v-if="row.kind === 'lesson'"
        class="relative flex items-center gap-3 min-h-10"
      >
        <span
          class="grid place-items-center size-8 shrink-0 rounded-full border border-ghost-border bg-surface text-sm font-bold text-on-ghost tabular-nums"
        >
          {{ row.slot }}
        </span>
        <span class="text-base tabular-nums text-on-ghost">{{ row.time }}</span>
      </div>

      <div
        v-else-if="row.kind === 'break'"
        class="relative flex flex-wrap items-center gap-x-3 gap-y-2 my-1 -ml-1 py-1.5 pl-1 pr-1.5 rounded-xl bg-surface"
      >
        <span
          class="grid place-items-center size-8 shrink-0 rounded-full text-on-ghost-muted"
        >
          <Coffee :size="16" aria-hidden="true" />
        </span>
        <span class="flex flex-col flex-1 min-w-24">
          <span class="text-sm font-medium text-on-ghost">
            {{
              editable
                ? t('groups.settings.schedule.config.break_label')
                : t('schedule.break', { minutes: row.minutes })
            }}
          </span>
          <span class="text-xs tabular-nums text-on-ghost-muted">
            {{ row.time }}
          </span>
        </span>

        <!-- Wrapped under the break on a phone, the controls line up with its label. -->
        <span
          v-if="editable"
          class="flex grow sm:grow-0 items-center justify-between gap-3 pl-11 sm:pl-0"
        >
          <span
            class="flex items-center rounded-lg border border-ghost-border bg-surface shadow-input has-focus-visible:ring-2 has-focus-visible:ring-focus"
          >
            <BaseButton
              size="xs"
              :icon="Minus"
              :disabled="row.minutes <= BREAK_STEP_MINS"
              :aria-label="t('groups.settings.schedule.config.shorter_break')"
              @click="stepMinutes(row.afterSlot, row.minutes, -1)"
            />
            <input
              :value="row.minutes"
              type="number"
              inputmode="numeric"
              min="1"
              :max="MAX_BREAK_MINS"
              class="w-9 bg-transparent text-center text-base tabular-nums text-on-ghost outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              :aria-label="
                t('groups.settings.schedule.config.break_minutes_label', {
                  slot: row.afterSlot,
                })
              "
              @input="onMinutesInput(row.afterSlot, $event)"
              @change="onMinutesChange(row.minutes, $event)"
            />
            <span class="text-sm text-on-ghost-muted" aria-hidden="true">
              {{ t('groups.settings.schedule.config.minutes_unit') }}
            </span>
            <BaseButton
              size="xs"
              :icon="Plus"
              :disabled="row.minutes >= MAX_BREAK_MINS"
              :aria-label="t('groups.settings.schedule.config.longer_break')"
              @click="stepMinutes(row.afterSlot, row.minutes, 1)"
            />
          </span>

          <span class="flex items-center">
            <BaseTooltip
              v-for="{ direction, toSlot, icon } in [
                {
                  direction: 'earlier',
                  toSlot: row.earlierSlot,
                  icon: ArrowUp,
                },
                { direction: 'later', toSlot: row.laterSlot, icon: ArrowDown },
              ]"
              :key="direction"
              :content="
                toSlot === null
                  ? undefined
                  : t('groups.settings.schedule.config.move_break', {
                      slot: toSlot,
                    })
              "
              :disabled="toSlot === null"
              placement="top"
            >
              <BaseButton
                size="xs"
                :icon="icon"
                :disabled="toSlot === null"
                :aria-label="
                  toSlot === null
                    ? undefined
                    : t('groups.settings.schedule.config.move_break', {
                        slot: toSlot,
                      })
                "
                @click="toSlot !== null && emit('move', row.afterSlot, toSlot)"
              />
            </BaseTooltip>
            <BaseTooltip
              :content="t('groups.settings.schedule.config.remove_break')"
              placement="top"
            >
              <BaseButton
                size="xs"
                class="hover:text-danger!"
                :icon="Trash2"
                :aria-label="t('groups.settings.schedule.config.remove_break')"
                @click="emit('remove', row.afterSlot)"
              />
            </BaseTooltip>
          </span>
        </span>
      </div>

      <button
        v-else
        type="button"
        class="group/gap relative flex items-center gap-3 w-full min-h-8 rounded-lg text-on-ghost-subtle hover:text-action focus-visible:text-action outline-none focus-visible:ring-2 focus-visible:ring-focus cursor-pointer transition-colors"
        :aria-label="
          t('groups.settings.schedule.config.add_break_after', {
            slot: row.afterSlot,
          })
        "
        @click="emit('add', row.afterSlot)"
      >
        <span class="grid place-items-center size-8 shrink-0">
          <span
            class="grid place-items-center size-5 rounded-full border border-dashed border-current bg-surface"
          >
            <Plus :size="12" aria-hidden="true" />
          </span>
        </span>
        <span class="text-xs font-medium">
          {{ t('groups.settings.schedule.config.add_break_button') }}
        </span>
      </button>
    </li>
  </ol>
</template>
