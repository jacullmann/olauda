<script setup lang="ts">
import { computed } from 'vue';
import {
  GLIDE_EASING,
  SETTLE_EASING,
  prefersReducedMotion,
} from '@/common/utils/motion';

const props = withDefaults(
  defineProps<{
    show: boolean;
    /**
     * The side the content slides in from, staying against what it pushes
     * aside. Without it, the content grows in place.
     */
    from?: 'left' | 'right';
  }>(),
  { from: undefined },
);

const REVEAL_MS = 520;
const CONCEAL_MS = 320;
/** Below this share of its room, the content is hidden. */
const POP_SCALE = 0.6;

// The wrapper is what grows; its content keeps its size and overflows the
// wrapper towards the side it comes from, so its far edge travels with the
// content it pushes aside.
const alignment = computed(() =>
  props.from === 'left'
    ? 'justify-end'
    : props.from === 'right'
      ? 'justify-start'
      : 'justify-center',
);

const running = new WeakMap<Element, Animation[]>();

/**
 * The wrapper also stands in for the gap beside it, so the content next to it
 * moves along one curve from its first frame to its last.
 */
function gapMargin(el: HTMLElement) {
  const gap = parseFloat(getComputedStyle(el.parentElement!).columnGap) || 0;
  const side = el.nextElementSibling ? 'marginRight' : 'marginLeft';
  return { side, closed: `${-gap}px` } as const;
}

/**
 * Runs on the same curve as the wrapper, so each offset is a share of its
 * width: content growing in place is never wider than its room, and never
 * covers its neighbours on the way.
 */
function contentFrames(shown: boolean): Keyframe[] {
  const hidden = { opacity: 0, scale: props.from ? '1' : String(POP_SCALE) };
  const visible = { opacity: 1, scale: '1' };
  return shown
    ? [hidden, { ...hidden, offset: POP_SCALE }, visible]
    : [visible, { ...hidden, offset: 1 - POP_SCALE }, hidden];
}

function play(el: HTMLElement, animations: Animation[], done: () => void) {
  running.set(el, animations);
  animations[0]!.onfinish = () => {
    running.delete(el);
    done();
  };
}

function reveal(el: Element, done: () => void) {
  if (prefersReducedMotion()) return done();
  const wrapper = el as HTMLElement;
  const content = wrapper.firstElementChild as HTMLElement | null;
  const { side, closed } = gapMargin(wrapper);
  // No overshoot: growing past its size would briefly crowd its neighbours
  // and could wrap them onto another line.
  const timing = { duration: REVEAL_MS, easing: SETTLE_EASING };

  play(
    wrapper,
    [
      wrapper.animate(
        [
          { width: '0px', [side]: closed },
          { width: `${wrapper.offsetWidth}px`, [side]: '0px' },
        ],
        timing,
      ),
      ...(content ? [content.animate(contentFrames(true), timing)] : []),
    ],
    done,
  );
}

function conceal(el: Element, done: () => void) {
  if (prefersReducedMotion()) return done();
  const wrapper = el as HTMLElement;
  const content = wrapper.firstElementChild as HTMLElement | null;
  const { side, closed } = gapMargin(wrapper);
  const timing = { duration: CONCEAL_MS, easing: GLIDE_EASING };

  // Taken before the entrance is stopped, so a reveal cut short turns back
  // from wherever it got to.
  const style = getComputedStyle(wrapper);
  const from = { width: style.width, [side]: style[side] };
  const contentStyle = content && getComputedStyle(content);
  const contentFrom = contentStyle && {
    opacity: contentStyle.opacity,
    scale: contentStyle.scale === 'none' ? '1' : contentStyle.scale,
  };
  running.get(wrapper)?.forEach((animation) => animation.cancel());

  play(
    wrapper,
    [
      wrapper.animate([from, { width: '0px', [side]: closed }], timing),
      ...(content && contentFrom
        ? [
            content.animate(
              [contentFrom, ...contentFrames(false).slice(1)],
              timing,
            ),
          ]
        : []),
    ],
    done,
  );
}
</script>

<template>
  <Transition :css="false" @enter="reveal" @leave="conceal">
    <span v-if="show" class="inline-flex *:shrink-0" :class="alignment">
      <slot />
    </span>
  </Transition>
</template>
