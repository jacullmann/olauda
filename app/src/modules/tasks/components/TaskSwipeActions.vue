<script setup lang="ts">
import { computed, type Component } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Archive,
  ArchiveRestore,
  Copy,
  Ellipsis,
  Trash2,
  Pencil,
  Pin,
  PinOff,
} from '@lucide/vue';
import {
  SWIPE_BUTTON_GAP,
  SWIPE_BUTTON_SIZE,
  type SwipeAction,
} from '@/modules/tasks/composables/useSwipeCard';
import type { Props as BaseButtonProps } from '@/common/components/BaseButton.vue';
import type { SwipeSide } from '@/modules/tasks/composables/useSwipeToDismiss';

const props = defineProps<{
  /** The card edge the buttons come out from. */
  side: SwipeSide;
  action: SwipeAction;
  secondaryAction?: SwipeAction;
  /** How far the card is drawn aside, eased with it frame by frame. */
  offset: number;
  /** Past the commit point, or sliding out: the main action takes over. */
  isTakingOver: boolean;
}>();

defineEmits<{
  (e: 'action'): void;
  (e: 'secondary-action', event: MouseEvent): void;
}>();

const { t } = useI18n();

const buttons: Record<
  SwipeAction,
  { icon: Component; labelKey: string; variant: BaseButtonVariant }
> = {
  archive: {
    icon: Archive,
    labelKey: 'tasks.list.tasks.menu.archive',
    variant: 'danger',
  },
  keep: {
    icon: ArchiveRestore,
    labelKey: 'tasks.list.tasks.menu.unarchive',
    variant: 'success',
  },
  delete: {
    icon: Trash2,
    labelKey: 'common.buttons.delete',
    variant: 'danger',
  },
  edit: {
    icon: Pencil,
    labelKey: 'common.buttons.edit',
    variant: 'ghost',
  },
  pin: {
    icon: Pin,
    labelKey: 'tasks.list.tasks.menu.pin',
    variant: 'ghost',
  },
  unpin: {
    icon: PinOff,
    labelKey: 'tasks.list.tasks.menu.unpin',
    variant: 'ghost',
  },
  duplicate: {
    icon: Copy,
    labelKey: 'common.buttons.duplicate',
    variant: 'ghost',
  },
  menu: {
    icon: Ellipsis,
    labelKey: 'common.more',
    variant: 'ghost',
  },
};

const primaryButton = computed(() => buttons[props.action]);
const secondaryButton = computed(() =>
  props.secondaryAction ? buttons[props.secondaryAction] : null,
);

type BaseButtonVariant = NonNullable<BaseButtonProps['variant']>;

/** Swaps the button layout while the finger keeps moving, so it runs on its own clock. */
const TAKEOVER_TIMING = '320ms var(--ease-settle)';
/** Quicker than the takeover, so the secondary button is gone before the main one reaches it. */
const SECONDARY_FADE_TIMING = '120ms ease-out';

const BUTTON_STEP = SWIPE_BUTTON_SIZE + SWIPE_BUTTON_GAP;

const trayStyle = computed(() => ({ width: `${props.offset}px` }));

/**
 * A button grows from its centre, so once the card's edge is past that, the
 * growing button never reaches under the card.
 */
const POP_IN_START = SWIPE_BUTTON_SIZE / 2;
/** Fully grown by the time the card rests a gap past the button. */
const POP_IN_DISTANCE = SWIPE_BUTTON_SIZE / 2 + SWIPE_BUTTON_GAP;

/** 0 until the card's edge has passed the button's centre, 1 once the card could rest. */
function buttonProgress(buttonIndex: number) {
  const pastCentre =
    props.offset - SWIPE_BUTTON_GAP - buttonIndex * BUTTON_STEP - POP_IN_START;
  return Math.min(1, Math.max(0, pastCentre / POP_IN_DISTANCE));
}

// Widths and offsets are expressed against the strip (`100%`) so they follow
// the finger without a transition, which only the takeover needs.
const STRIP_INSET = 2 * SWIPE_BUTTON_GAP;
/** Room left of the main button for the secondary one and the gaps around it. */
const SECONDARY_INSET = 3 * SWIPE_BUTTON_GAP + SWIPE_BUTTON_SIZE;

// The buttons rest against the card's far edge and stay put while the card uncovers them.
// Past that, the secondary button rides along at a gap from the card's edge
// and the main button widens to fill the space it leaves. Taking over, the
// main button widens over the secondary one as well.
const primarySlotStyle = computed(() => {
  const restingInset = secondaryButton.value ? SECONDARY_INSET : STRIP_INSET;
  return {
    scale: buttonProgress(0),
    opacity: buttonProgress(0),
    [props.side]: `${SWIPE_BUTTON_GAP}px`,
    width: props.isTakingOver
      ? `calc(100% - ${STRIP_INSET}px)`
      : `max(${SWIPE_BUTTON_SIZE}px, calc(100% - ${restingInset}px))`,
    transition: `width ${TAKEOVER_TIMING}`,
  };
});

const secondarySlotStyle = computed(() => ({
  scale: buttonProgress(1),
  [props.side]: `max(${SWIPE_BUTTON_GAP + BUTTON_STEP}px, calc(100% - ${BUTTON_STEP}px))`,
  width: `${SWIPE_BUTTON_SIZE}px`,
  opacity: props.isTakingOver ? 0 : buttonProgress(1),
  // Only the takeover fades it; otherwise it follows the card frame by frame.
  transition: props.isTakingOver ? `opacity ${SECONDARY_FADE_TIMING}` : 'none',
}));
</script>

<template>
  <div
    class="absolute inset-y-0 isolate overflow-hidden"
    :class="side === 'left' ? 'left-0' : 'right-0'"
    :style="trayStyle"
  >
    <div
      v-if="secondaryButton"
      class="absolute inset-y-0 flex items-center"
      :style="secondarySlotStyle"
    >
      <BaseButton
        full
        surface
        :variant="secondaryButton.variant"
        :icon="secondaryButton.icon"
        :aria-label="t(secondaryButton.labelKey)"
        :title="t(secondaryButton.labelKey)"
        :tabindex="isTakingOver ? -1 : undefined"
        @click.stop="$emit('secondary-action', $event)"
      />
    </div>

    <div
      class="absolute inset-y-0 z-10 flex items-center"
      :style="primarySlotStyle"
    >
      <BaseButton
        full
        surface
        :variant="primaryButton.variant"
        :icon="primaryButton.icon"
        :aria-label="t(primaryButton.labelKey)"
        :title="t(primaryButton.labelKey)"
        @click="$emit('action')"
      />
    </div>
  </div>
</template>
