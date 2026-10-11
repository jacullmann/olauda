<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { CalendarDays, ChevronLeft, ChevronRight } from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { useFloating, offset, flip, shift, autoUpdate } from '@floating-ui/vue';
import { useSwipePager } from '@/common/composables/useSwipePager';
import { labelTextFor } from '@/utils/labelText';

/** Value format matches `<input type="date">`: `YYYY-MM-DD`. */
const model = defineModel<string | null>();

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    id: string;
    /** Mobile sheet title; defaults to the text of the picker's label. */
    title?: string;
    min?: string;
    max?: string;
    disabled?: boolean;
    /** Shown while no day is picked. */
    placeholder?: string;
  }>(),
  {
    title: undefined,
    min: undefined,
    max: undefined,
    disabled: false,
    placeholder: undefined,
  },
);

const { t, locale } = useI18n();

const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromKey = (key: string) => {
  const [y = 0, m = 1, d = 1] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const todayKey = toKey(new Date());
const isDisabled = (key: string) =>
  (!!props.min && key < props.min) || (!!props.max && key > props.max);

const isOpen = ref(false);
const sheetTitle = ref<string>();
const cursor = ref(new Date()); // focused day, drives the visible month
const triggerRef = ref<any>(null);
const floatingRef = ref<any>(null);
const gridRef = ref<HTMLElement | null>(null);

const triggerEl = computed(() => triggerRef.value?.$el || null);
const menuEl = computed(() => floatingRef.value?.menuEl || null);

const { floatingStyles, isPositioned } = useFloating(triggerEl, menuEl, {
  placement: 'bottom-start',
  whileElementsMounted: autoUpdate,
  transform: false,
  middleware: [offset(4), flip(), shift({ padding: 8 })],
});

// Week start from locale (Mon for de, Sun for en-US); falls back to Monday.
const weekStart = computed(() => {
  const loc = new Intl.Locale(locale.value) as any;
  return ((loc.getWeekInfo?.() ?? loc.weekInfo)?.firstDay ?? 1) % 7;
});

const weekdays = computed(() => {
  const fmt = new Intl.DateTimeFormat(locale.value, { weekday: 'short' });
  // 2024-01-07 is a Sunday
  return Array.from({ length: 7 }, (_, i) =>
    fmt.format(new Date(2024, 0, 7 + weekStart.value + i)).slice(0, 2),
  );
});

const monthLabel = computed(() =>
  new Intl.DateTimeFormat(locale.value, {
    month: 'long',
    year: 'numeric',
  }).format(cursor.value),
);

const monthGrid = (first: Date) => {
  const leading = (first.getDay() - weekStart.value + 7) % 7;
  const daysInMonth = new Date(
    first.getFullYear(),
    first.getMonth() + 1,
    0,
  ).getDate();
  const start = addDays(first, -leading);
  const days = Array.from({ length: leading + daysInMonth }, (_, i) => {
    const date = addDays(start, i);
    return {
      key: toKey(date),
      day: date.getDate(),
      outside: i < leading,
      weekend: date.getDay() === 0 || date.getDay() === 6,
    };
  });
  return { days, weekCount: Math.ceil(days.length / 7) };
};

const cursorKey = computed(() => toKey(cursor.value));
const monthKey = computed(() => cursorKey.value.slice(0, 7));

const monthIndex = (d: Date) => d.getFullYear() * 12 + d.getMonth();

const trackRef = ref<HTMLElement | null>(null);
const { reach } = useSwipePager(trackRef, gridRef, {
  page: () => monthIndex(cursor.value),
  onSwipe: (step) => shiftMonth(step),
});

// Keyed by `monthKey`, not `cursor`, so moving within a month keeps the grids.
const monthPanels = computed(() => {
  const [year = 0, month = 1] = monthKey.value.split('-').map(Number);
  return Array.from({ length: 2 * reach.value + 1 }, (_, i) => {
    const offset = i - reach.value;
    const first = new Date(year, month - 1 + offset, 1);
    return { offset, key: toKey(first).slice(0, 7), ...monthGrid(first) };
  });
});

const relativeLabel = computed(() => {
  const rtf = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' });
  return (value: number, unit: Intl.RelativeTimeFormatUnit) => {
    const s = rtf.format(value, unit);
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
});

const shortcuts = computed(() => {
  const now = new Date();
  return [
    { label: relativeLabel.value(1, 'day'), key: toKey(addDays(now, 1)) },
    { label: relativeLabel.value(1, 'week'), key: toKey(addDays(now, 7)) },
  ].filter((s) => !isDisabled(s.key));
});

const selectedRelativeLabel = computed(() =>
  model.value === todayKey
    ? relativeLabel.value(0, 'day')
    : shortcuts.value.find((s) => s.key === model.value)?.label,
);

const displayLabel = computed(() =>
  model.value
    ? new Intl.DateTimeFormat(locale.value, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year:
          fromKey(model.value).getFullYear() === new Date().getFullYear()
            ? undefined
            : 'numeric',
      }).format(fromKey(model.value))
    : (props.placeholder ?? t('common.selection.placeholder')),
);

const focusCursor = async (options?: FocusOptions) => {
  await nextTick();
  gridRef.value
    ?.querySelector<HTMLElement>(`[data-key="${cursorKey.value}"]`)
    ?.focus(options);
};

const toggle = () => {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    sheetTitle.value = props.title ?? labelTextFor(props.id);
    cursor.value = model.value ? fromKey(model.value) : new Date();
    void focusCursor();
  }
};

const close = () => {
  isOpen.value = false;
  triggerRef.value?.focus();
};

const select = (key: string) => {
  if (isDisabled(key)) return;
  model.value = key;
  close();
};

const shiftMonth = (n: number) => {
  const c = cursor.value;
  const target = new Date(c.getFullYear(), c.getMonth() + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0);
  target.setDate(Math.min(c.getDate(), lastDay.getDate()));
  cursor.value = target;
};

const keySteps: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

const onGridKeydown = (e: KeyboardEvent) => {
  const step = keySteps[e.key];
  if (step) cursor.value = addDays(cursor.value, step);
  else if (e.key === 'PageUp') shiftMonth(-1);
  else if (e.key === 'PageDown') shiftMonth(1);
  else return;
  // Keep BaseMenu's linear arrow navigation out of the grid
  e.preventDefault();
  e.stopPropagation();
  // The day may still be sliding in from beyond the clipped edge, where
  // scrolling it into view would shift the menu sideways.
  void focusCursor({ preventScroll: true });
};
</script>

<template>
  <div class="relative">
    <BaseButton
      :id="id"
      ref="triggerRef"
      :disabled="disabled"
      variant="input"
      class="outline-none transition-focus"
      :class="isOpen ? 'border-focus! shadow-focus-ring!' : ''"
      aria-haspopup="dialog"
      :aria-expanded="isOpen"
      :icon="CalendarDays"
      icon-placement="trailing"
      icon-classes="ml-auto shrink-0 text-on-ghost-muted"
      v-bind="$attrs"
      @pointerdown.stop
      @click="toggle"
    >
      <span class="truncate" :class="{ 'text-on-ghost-subtle': !model }">
        {{ displayLabel }}
      </span>
      <span
        v-if="selectedRelativeLabel"
        class="-ml-1 shrink-0 text-on-ghost-muted"
      >
        · {{ selectedRelativeLabel }}
      </span>
    </BaseButton>

    <Teleport to="body">
      <BaseMenu
        ref="floatingRef"
        :open="isOpen"
        :title="sheetTitle"
        :style="{
          ...floatingStyles,
          zIndex: 100002,
          opacity: isPositioned ? undefined : 0,
        }"
        @close="isOpen = false"
      >
        <!-- Stop Escape here so it closes only the picker, not a parent modal -->
        <div class="flex flex-col gap-2 p-1" @keydown.esc.stop="close">
          <div v-if="shortcuts.length" class="flex flex-wrap gap-1.5">
            <BaseButton
              v-for="s in shortcuts"
              :key="s.key"
              type="button"
              size="sm"
              :variant="model === s.key ? 'action' : 'ghost'"
              surface
              @click="select(s.key)"
            >
              {{ s.label }}
            </BaseButton>
          </div>

          <div class="flex items-center justify-between">
            <BaseButton
              :icon="ChevronLeft"
              :aria-label="t('common.date.previous_month')"
              @click="shiftMonth(-1)"
            />
            <span
              class="text-sm font-semibold text-on-ghost capitalize"
              aria-live="polite"
            >
              {{ monthLabel }}
            </span>
            <BaseButton
              :icon="ChevronRight"
              :aria-label="t('common.date.next_month')"
              @click="shiftMonth(1)"
            />
          </div>

          <div
            ref="gridRef"
            role="grid"
            :aria-label="monthLabel"
            class="text-center"
            @keydown="onGridKeydown"
          >
            <div class="grid grid-cols-7" aria-hidden="true">
              <span
                v-for="(w, i) in weekdays"
                :key="i"
                class="pb-1 text-xs font-medium text-on-ghost-muted"
                >{{ w }}</span
              >
            </div>
            <!-- Neighbouring months wait beside the visible one, clipped, so a
                 swipe drags them in. The clip reaches into the menu padding
                 for the focus ring. Height of six packed rows, the tallest
                 month, keeps the menu steady; 5-week months spread out, 4-week
                 ones leave a row free -->
            <div class="-mx-1 overflow-x-clip touch-pan-y">
              <div ref="trackRef" class="grid will-change-transform">
                <div
                  v-for="panel in monthPanels"
                  :key="panel.key"
                  class="col-start-1 row-start-1 grid h-[calc(6*--spacing(10))] grid-cols-7 px-1"
                  :class="panel.weekCount === 6 ? 'grid-rows-6' : 'grid-rows-5'"
                  :style="{ transform: `translateX(${panel.offset * 100}%)` }"
                  :inert="panel.offset !== 0"
                >
                  <template v-for="d in panel.days" :key="d.key">
                    <span v-if="d.outside" aria-hidden="true" />
                    <!-- Button fills its grid cell so the tap area grows with the
                         spacing but never overlaps a neighbour -->
                    <button
                      v-else
                      type="button"
                      role="gridcell"
                      :data-key="d.key"
                      :tabindex="d.key === cursorKey ? 0 : -1"
                      :disabled="isDisabled(d.key)"
                      :aria-selected="d.key === model"
                      :aria-current="d.key === todayKey ? 'date' : undefined"
                      class="group grid size-full place-items-center cursor-pointer outline-none disabled:cursor-not-allowed"
                      @click="select(d.key)"
                    >
                      <span
                        class="grid size-10 place-items-center rounded-full text-sm tabular-nums transition-hover group-focus-visible:ring-2 group-focus-visible:ring-focus"
                        :class="
                          d.key === model
                            ? [
                                'font-semibold',
                                d.key === todayKey
                                  ? 'bg-accent text-on-accent'
                                  : 'bg-action text-on-action',
                              ]
                            : [
                                'group-enabled:group-hover:bg-ghost-hover',
                                isDisabled(d.key)
                                  ? 'text-on-ghost-subtle'
                                  : d.key === todayKey
                                    ? 'text-accent font-bold'
                                    : [
                                        'group-enabled:group-hover:text-on-ghost',
                                        d.weekend
                                          ? 'text-on-ghost-muted'
                                          : 'text-on-ghost',
                                      ],
                              ]
                        "
                      >
                        {{ d.day }}
                      </span>
                    </button>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </BaseMenu>
    </Teleport>
  </div>
</template>
