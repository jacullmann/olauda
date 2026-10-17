<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Equal, Trash2 } from '@lucide/vue';
import {
  useDragReorder,
  REORDER_ITEM_ATTR,
} from '@/common/composables/useDragReorder';
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
  setMinutes: [afterSlot: number, minutes: number];
  remove: [afterSlot: number];
  move: [afterSlot: number, toSlot: number];
}>();

const { t } = useI18n();

type PlanRow =
  | { kind: 'lesson'; key: string; slot: number; time: string }
  | {
      kind: 'break';
      key: string;
      afterSlot: number;
      minutes: number;
      time: string;
    };

let breakKeyCount = 0;
const breakKeys = new Map<number, number>();

/**
 * A moved break keeps its key, so its element lands where it was dropped
 * instead of being recreated, and its handle keeps the focus.
 */
function breakKey(afterSlot: number) {
  let key = breakKeys.get(afterSlot);
  if (key === undefined) breakKeys.set(afterSlot, (key = breakKeyCount++));
  return `break-${key}`;
}

/** Every lesson, each followed by its break if it has one. */
const rows = computed(() => {
  const { times, totalSlots, breaks } = props;
  const startOf = (slot: number) => slotStartMinutesWith(times, breaks, slot);

  const planRows: PlanRow[] = [];
  for (let slot = 1; slot <= totalSlots; slot++) {
    const start = startOf(slot);
    const end = start + times.lessonDurationMins;
    planRows.push({
      kind: 'lesson',
      key: `lesson-${slot}`,
      slot,
      time: formatMinuteRange({ start, end }),
    });
    if (slot === totalSlots) break;

    const minutes = breaks[slot];
    if (minutes) {
      planRows.push({
        kind: 'break',
        key: breakKey(slot),
        afterSlot: slot,
        minutes,
        time: formatMinuteRange({ start: end, end: end + minutes }),
      });
    }
  }
  return planRows;
});

function moveBreak(afterSlot: number, toSlot: number) {
  breakKeys.set(toSlot, breakKeys.get(afterSlot) ?? breakKeyCount++);
  breakKeys.delete(afterSlot);
  emit('move', afterSlot, toSlot);
}

/** A break lands after the lesson above where it was dropped, if that one has none. */
function dropBreak(from: number, to: number) {
  const dragged = rows.value[from];
  if (dragged?.kind !== 'break') return;

  const order = rows.value.filter((row) => row !== dragged);
  const lessonAbove = order
    .slice(0, to)
    .findLast((row) => row.kind === 'lesson');
  if (lessonAbove?.kind !== 'lesson') return;

  const toSlot = lessonAbove.slot;
  if (toSlot === dragged.afterSlot || toSlot >= props.totalSlots) return;
  if (props.breaks[toSlot]) return;
  moveBreak(dragged.afterSlot, toSlot);
}

const BREAK_HANDLE = '[data-break-handle]';

const listRef = ref<HTMLElement | null>(null);
const reorder = useDragReorder(listRef, {
  onMove: dropBreak,
  handle: BREAK_HANDLE,
});

/** Steps the break past one lesson, with the same motion as dropping it. */
async function stepBreak(index: number, step: 1 | -1, event: KeyboardEvent) {
  const to = index + step;
  if (to < 0 || to >= rows.value.length) return;
  const handle = event.currentTarget as HTMLElement;
  reorder.move(index, to);
  // Vue may move the row's element, which drops its focus.
  await nextTick();
  handle.focus();
}
</script>

<template>
  <ol ref="listRef" class="relative m-0 p-0 list-none">
    <li
      v-for="(row, index) in rows"
      :key="row.key"
      v-bind="{ [REORDER_ITEM_ATTR]: '' }"
      class="reorder-item relative not-last:after:absolute not-last:after:inset-x-0 not-last:after:bottom-0 not-last:after:border-b not-last:after:border-ghost-border after:opacity-[calc(1-var(--lift,0))]"
      :class="
        row.kind === 'break' &&
        '-mx-3 px-3 after:inset-x-3! rounded-xl bg-[color-mix(in_oklab,var(--color-surface)_calc(var(--lift,0)*100%),var(--color-canvas))]'
      "
    >
      <div
        v-if="row.kind === 'lesson'"
        class="relative flex flex-col justify-center py-2 min-h-16"
      >
        <span class="shrink-0 text-lg font-bold text-on-ghost tabular-nums">
          {{ t('schedule.period', { slot: row.slot }) }}
        </span>
        <span class="text-sm tabular-nums text-on-ghost-muted">{{
          row.time
        }}</span>
      </div>

      <div
        v-else-if="row.kind === 'break'"
        class="relative flex justify-between items-center gap-2 py-2 min-h-16"
      >
        <span class="flex items-center gap-2">
          <BaseInlineReveal :show="editable" from="left">
            <BaseTooltip
              :content="t('groups.settings.schedule.config.remove_break')"
              placement="top"
            >
              <BaseButton
                size="sm"
                variant="danger"
                :icon="Trash2"
                :aria-label="t('groups.settings.schedule.config.remove_break')"
                @click="emit('remove', row.afterSlot)"
              />
            </BaseTooltip>
          </BaseInlineReveal>
          <span class="flex flex-col justify-center">
            <span class="text-lg font-bold text-on-ghost">{{
              t('groups.settings.schedule.config.break_label')
            }}</span>
            <span class="text-sm tabular-nums text-on-ghost-muted">{{
              row.time
            }}</span>
          </span>
        </span>

        <span class="flex items-center gap-2">
          <BaseInlineReveal :show="editable">
            <BaseStepper
              :model-value="row.minutes"
              :min="BREAK_STEP_MINS"
              :max="MAX_BREAK_MINS"
              :step="BREAK_STEP_MINS"
              :decrement-label="t('groups.settings.schedule.config.shorter')"
              :increment-label="t('groups.settings.schedule.config.longer')"
              :aria-label="
                t('groups.settings.schedule.config.break_length_label', {
                  slot: row.afterSlot,
                })
              "
              @update:model-value="emit('setMinutes', row.afterSlot, $event)"
            />
          </BaseInlineReveal>
          <span
            class="text-base text-on-ghost"
            :aria-live="editable ? 'polite' : undefined"
          >
            {{ t('schedule.minutes_short', { minutes: row.minutes }) }}
          </span>
          <BaseInlineReveal :show="editable" from="right">
            <!-- The padding widens the grip without moving the icon. -->
            <span
              role="button"
              tabindex="0"
              class="flex p-2 -m-2 rounded-lg text-on-ghost-muted cursor-grab touch-none select-none"
              data-break-handle
              :aria-label="
                t('groups.settings.schedule.config.move_break', {
                  slot: row.afterSlot,
                })
              "
              aria-keyshortcuts="ArrowUp ArrowDown"
              @keydown.up.prevent="stepBreak(index, -1, $event)"
              @keydown.down.prevent="stepBreak(index, 1, $event)"
            >
              <Equal class="size-4.5" aria-hidden="true" />
            </span>
          </BaseInlineReveal>
        </span>
      </div>
    </li>
  </ol>
</template>
