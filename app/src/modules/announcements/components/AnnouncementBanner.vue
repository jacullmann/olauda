<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useElementSize, usePreferredReducedMotion } from '@vueuse/core';
import { Info, Megaphone } from '@lucide/vue';
import { useAnnouncementListModal } from '@/modules/announcements/stores/useAnnouncementListModal';
import { morphOriginOf } from '@/common/utils/morph';
import { SETTLE_EASING } from '@/common/utils/motion';
import { useSwipeAway } from '@/modules/announcements/composables/useSwipeAway';
import { useAnnouncementFeed } from '@/modules/announcements/composables/useAnnouncementFeed';
import type { AnnouncementScope } from '@/modules/announcements/types';

const props = defineProps<{
  /** Where read announcements live from now on; the card shrinks into it. */
  collapseTarget: HTMLElement | null;
}>();

const { t } = useI18n();
const announcementsModal = useAnnouncementListModal();
const { unread, acknowledge, acknowledgeAll } = useAnnouncementFeed();
const reducedMotion = usePreferredReducedMotion();

const current = computed(() => unread.value[0]);
const hasMore = computed(() => unread.value.length > 1);

// Only the group's announcements stay listed once read; the platform's are
// gone, so there is no list for them to open or to shrink into.
const opensList = computed(() => current.value?.scope === 'group');
const LIST_TRIGGER_ATTRS = { type: 'button', 'aria-haspopup': 'dialog' };

/** Outlives the card's last announcement, which the leave animation needs. */
const shownScope = ref<AnnouncementScope>('group');
watch(current, (announcement) => {
  if (announcement) shownScope.value = announcement.scope;
});

// Phones keep the button beside the text only while the text fits there on
// one line; it would otherwise wrap into a narrow column. Plain flex wrapping
// could decide that too, but not then move the button behind the "more" row.
const card = useTemplateRef('card');
const text = useTemplateRef('text');
const ackButton = useTemplateRef('ackButton');
const { width: cardWidth } = useElementSize(card);
const { width: textWidth } = useElementSize(text);
const { width: ackWidth } = useElementSize(
  () => ackButton.value?.$el as HTMLElement | undefined,
  undefined,
  { box: 'border-box' },
);
const ackFitsBesideText = computed(() => {
  const textEl = text.value;
  if (!card.value || !textEl?.parentElement) return true;
  const textStart = textEl.offsetLeft - textEl.parentElement.offsetLeft;
  const gap = parseFloat(getComputedStyle(card.value).columnGap);
  return textStart + textWidth.value + gap + ackWidth.value <= cardWidth.value;
});

function openList() {
  if (!current.value || !opensList.value) return;
  announcementsModal.show(morphOriginOf(card.value));
  void acknowledge(current.value);
}

const { swipeStyle, isGone, reset } = useSwipeAway(card, {
  onSwipedAway: () => void acknowledgeSwipedAway(),
});

async function acknowledgeSwipedAway() {
  if (!current.value) return;
  void acknowledge(current.value);
  await nextTick();
  // The last one leaves for good; any other comes back in with the next one.
  if (!current.value) return;
  reset();
  card.value?.animate(
    [
      { opacity: 0, scale: 0.95 },
      { opacity: 1, scale: 1 },
    ],
    {
      duration: 300,
      easing: SETTLE_EASING,
    },
  );
}

function collapse(el: Element, done: () => void) {
  // Swiped off screen already.
  if (isGone.value) {
    done();
    return;
  }

  const target = props.collapseTarget;
  // Read by opening the list, which grows out of the card in its place.
  if (
    !target ||
    shownScope.value === 'system' ||
    announcementsModal.isOpen ||
    reducedMotion.value === 'reduce'
  ) {
    el.animate([{ opacity: 1 }, { opacity: 0 }], 150).finished.then(done, done);
    return;
  }

  const from = el.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + to.height / 2 - (from.top + from.height / 2);
  const scale = Math.min(to.width / from.width, to.height / from.height);

  // Stays opaque for most of the way, so the eye can follow it into the
  // group menu, where the announcement can be found again.
  el.animate(
    [
      { transform: 'none', opacity: 1 },
      { opacity: 1, offset: 0.6 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scale})`, opacity: 0 },
    ],
    { duration: 450, easing: 'cubic-bezier(0.5, 0, 0.75, 0)' },
  ).finished.then(done, done);
}
</script>

<template>
  <div
    class="pointer-events-none absolute inset-x-0 top-full z-(--z-header) flex justify-center px-2"
    role="status"
    aria-live="polite"
  >
    <Transition
      enter-active-class="transition-[opacity,translate,scale] duration-400 ease-(--ease-spring)"
      enter-from-class="opacity-0 -translate-y-2 scale-95"
      @leave="collapse"
    >
      <section
        v-if="current"
        ref="card"
        :style="swipeStyle"
        class="pointer-events-auto relative flex touch-none w-full max-w-xl flex-wrap items-center gap-4 rounded-3xl border border-ghost-border bg-surface/80 p-4 shadow-menu backdrop-blur-sm backdrop-saturate-150"
      >
        <!-- A card swiped away comes back with the next one already in it.
             Not out-in then: Vue cannot re-render from a leave that ends
             synchronously. -->
        <Transition
          :css="!isGone"
          :mode="isGone ? 'default' : 'out-in'"
          enter-active-class="transition-[opacity,translate] duration-200 ease-out"
          leave-active-class="transition-[opacity,translate] duration-150 ease-in"
          enter-from-class="opacity-0 translate-y-1"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <!-- Stretched over the whole card when it opens the list, so all
               of it does, while the buttons below sit above it. -->
          <component
            :is="opensList ? 'button' : 'div'"
            :key="`${current.scope}:${current.id}`"
            v-bind="opensList ? LIST_TRIGGER_ATTRS : {}"
            class="flex min-w-0 grow items-center gap-2 text-left xs:basis-0"
            :class="{
              'basis-full': !ackFitsBesideText,
              'cursor-pointer after:absolute after:inset-0 after:rounded-3xl':
                opensList,
            }"
            @click="openList"
          >
            <div
              class="flex flex-col items-center justify-center min-h-10 mb-auto"
            >
              <span
                class="flex w-10 shrink-0 items-center justify-center rounded-full"
                :class="
                  current.important ? 'text-danger' : 'text-on-ghost-muted'
                "
              >
                <Info v-if="current.scope === 'system'" :size="20" />
                <Megaphone v-else :size="20" />
              </span>
              <span
                v-if="hasMore"
                class="text-on-ghost-muted text-sm font-semibold"
                >+{{ unread.length - 1 }}</span
              >
            </div>
            <span ref="text" class="min-w-0 text-sm text-on-ghost break-words">
              <span
                v-if="current.scope === 'system'"
                class="block text-xs font-semibold text-on-ghost-muted"
                >{{ t('announcements.system.source') }}</span
              >
              {{ current.content }}
            </span>
          </component>
        </Transition>

        <BaseRow justify="end" class="relative w-full flex-wrap-reverse">
          <BaseButton
            v-if="hasMore"
            surface
            class="flex flex-1 min-w-fit"
            @click="acknowledgeAll()"
          >
            {{ t('announcements.card.acknowledge_all') }}
          </BaseButton>

          <BaseButton
            ref="ackButton"
            variant="action"
            class="flex flex-1 min-w-fit"
            @click="acknowledge(current)"
          >
            {{ t('announcements.card.acknowledge') }}
          </BaseButton>
        </BaseRow>
      </section>
    </Transition>
  </div>
</template>
