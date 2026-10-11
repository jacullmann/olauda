<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Reply, Ellipsis } from '@lucide/vue';
import { useLongPress } from '@/common/composables/useLongPress';
import { haptic } from '@/common/utils/haptics';

const { t } = useI18n();

const props = defineProps<{
  msg: any;
  isGrouped: boolean;
  currentUserId: string;
}>();

const emit = defineEmits<{
  (e: 'reply', msg: any): void;
  (e: 'menu', event: MouseEvent, msg: any): void;
  (e: 'scrollToMessage', id: string): void;
}>();

// Encapsulated mobile swipe gesture
let touchStartX = 0;
let touchStartY = 0;
const swipeX = ref(0);
const isSwiping = ref(false);

const handleTouchStart = (e: TouchEvent) => {
  const touch = e.touches[0];
  if (!touch) return;
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  isSwiping.value = false;
  swipeX.value = 0;
};

const handleTouchMove = (e: TouchEvent) => {
  const touch = e.touches[0];
  if (!touch) return;
  const diffX = touch.clientX - touchStartX;
  const diffY = touch.clientY - touchStartY;

  if (!isSwiping.value) {
    if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 8) {
      return;
    }
    if (Math.abs(diffX) > 8) {
      isSwiping.value = true;
    }
  }

  if (isSwiping.value) {
    if (diffX > 0) {
      if (e.cancelable) {
        e.preventDefault();
      }
      const maxSwipe = 80;
      swipeX.value = Math.min(diffX * 0.5, maxSwipe);
    } else {
      swipeX.value = 0;
    }
  }
};

const handleTouchEnd = () => {
  if (isSwiping.value && swipeX.value >= 40) {
    emit('reply', props.msg);
    haptic(15);
  }
  swipeX.value = 0;
  isSwiping.value = false;
};

const bubbleBorderClasses = computed(() => {
  const p = props.isGrouped;
  const r = props.msg.parentId && props.msg.parentContent;

  return `rounded-2xl ${
    props.msg.userId === props.currentUserId
      ? p
        ? r
          ? 'rounded-t-xl'
          : ''
        : r
          ? 'rounded-tl-xl rounded-tr-sm'
          : 'rounded-tr-sm'
      : p
        ? r
          ? 'rounded-t-xl'
          : 'rounded-tl-2xl'
        : 'rounded-tl-sm'
  }`;
});

const getEmojiInfo = computed(() => {
  const text = props.msg.content || '';
  if (!text) return { isEmojiOnly: false, count: 0 };

  try {
    const unicodeProperty = 'Extended_Pictographic';
    const emojiRegex = new RegExp(
      `[\\p{${unicodeProperty}}\\u{1F1E6}-\\u{1F1FF}\\u{2600}-\\u{27BF}]`,
      'u',
    );

    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
      const segments = [...segmenter.segment(text)];
      if (segments.length === 0) return { isEmojiOnly: false, count: 0 };
      const allEmojis = segments.every((s) => emojiRegex.test(s.segment));
      return {
        isEmojiOnly: allEmojis,
        count: allEmojis ? segments.length : 0,
      };
    } else {
      const emojiSequenceRegex = new RegExp(
        `(?:[\\u{1F1E6}-\\u{1F1FF}]{2}|[\\p{${unicodeProperty}}\\u{2600}-\\u{27BF}])(?:[\\u{1F3FB}-\\u{1F3FF}]|\\u{200D}|\\u{FE0F}|\\p{${unicodeProperty}}|[\\u{2600}-\\u{27BF}])*`,
        'gu',
      );
      const matches = text.match(emojiSequenceRegex) || [];
      const matchedLen = matches.join('').length;
      const isEmojiOnly = matchedLen === text.length;
      return { isEmojiOnly, count: isEmojiOnly ? matches.length : 0 };
    }
  } catch {
    // Safe fallback if RegExp 'u' flag or Unicode property escapes are not supported
    return { isEmojiOnly: false, count: 0 };
  }
});

const isBgTransparent = computed(() => {
  return (
    getEmojiInfo.value.isEmojiOnly &&
    getEmojiInfo.value.count === 1 &&
    !(props.msg.parentId && props.msg.parentContent)
  );
});

const { handlers: longPressHandlers } = useLongPress(
  (event) => emit('menu', event, props.msg),
  // Links and the bubble's own menu trigger answer a press themselves.
  { ignore: 'a, button, [role=menu]' },
);

const formatTime = (timestamp: string) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
</script>

<template>
  <div
    :id="`msg-${msg.id}`"
    class="group/msg long-press-target w-full px-2 md:px-8"
    :class="isGrouped ? 'mt-1' : 'mt-4'"
    v-on="longPressHandlers"
  >
    <div
      :class="[
        'flex items-end gap-2 max-w-[85%] sm:max-w-[70%] transition-all duration-200',
        msg.userId === currentUserId ? 'ml-auto flex-row-reverse' : 'mr-auto',
      ]"
    >
      <div
        v-if="msg.userId !== currentUserId"
        class="w-8 shrink-0 flex justify-center self-start"
      >
        <BaseAvatar
          v-if="msg.userId !== currentUserId && !isGrouped"
          :name="msg.senderName"
          :size="8"
        />
      </div>

      <div class="flex gap-0.5 relative max-w-full min-w-0">
        <!-- Swipe reply icon indicator -->
        <div
          v-if="swipeX > 0"
          class="absolute left-[-32px] top-1/2 flex items-center pointer-events-none z-0"
          :style="{
            opacity: Math.min(swipeX / 40, 1),
            transform: `scale(${swipeX >= 40 ? 1 : 0.85}) translateY(-50%)`,
          }"
        >
          <div
            class="size-9 rounded-full flex items-center justify-center transition-all duration-150"
            :class="
              swipeX >= 40
                ? 'bg-action text-on-action'
                : 'bg-ghost-hover text-on-ghost-subtle'
            "
          >
            <Reply :size="18" />
          </div>
        </div>

        <div
          :class="[
            'p-2 transition-all duration-200 relative group min-w-0 max-w-full',
            isBgTransparent
              ? 'bg-transparent text-on-ghost'
              : msg.userId === currentUserId
                ? 'bg-accent text-on-accent'
                : 'bg-ghost-hover text-on-ghost',
            bubbleBorderClasses,
          ]"
          :style="
            swipeX > 0
              ? { transform: `translateX(${swipeX}px)`, transition: 'none' }
              : {
                  transform: 'translateX(0px)',
                  transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                }
          "
          @touchstart="handleTouchStart"
          @touchmove="handleTouchMove"
          @touchend="handleTouchEnd"
        >
          <span
            v-if="msg.userId !== currentUserId && !isGrouped"
            class="px-2 text-base/relaxed font-bold text-on-ghost tracking-tight select-none mb-1"
          >
            {{ msg.senderName }}
          </span>

          <!-- Replying/Quoted Message -->
          <div
            v-if="msg.parentId && msg.parentContent"
            v-wave
            :class="[
              'relative overflow-hidden flex flex-col mb-1 px-3 py-2 text-sm rounded-md transition-all duration-150 cursor-pointer select-none max-w-full w-full min-w-0 before:content-[\'\'] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1',
              msg.userId === currentUserId
                ? 'bg-action-hover hover:bg-on-action/20 active:bg-on-action/20 before:bg-on-action-muted text-on-action-muted'
                : 'bg-ghost-hover hover:bg-on-ghost/15 active:bg-on-ghost/15 before:bg-on-ghost-muted text-on-ghost-muted mt-1',
            ]"
            :title="t('chat.quote_label')"
            @click="emit('scrollToMessage', msg.parentId)"
          >
            <div class="pl-1 flex flex-col">
              <span class="font-bold">
                {{
                  msg.parentUserId === currentUserId
                    ? t('chat.you')
                    : msg.parentSenderName
                }}
              </span>
              <span class="truncate">{{ msg.parentContent }}</span>
            </div>
          </div>

          <div
            class="px-2 flex flex-wrap items-end justify-between gap-x-2 gap-y-1 min-w-0"
          >
            <span
              :class="[
                'whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-snug py-[calc(var(--spacing)*.25)] min-w-0',
                getEmojiInfo.isEmojiOnly &&
                getEmojiInfo.count > 0 &&
                getEmojiInfo.count <= 3
                  ? getEmojiInfo.count === 1
                    ? 'text-5xl'
                    : getEmojiInfo.count === 2
                      ? 'text-3xl'
                      : 'text-xl'
                  : 'text-base',
              ]"
            >
              {{ msg.content }}
            </span>
            <span
              :class="[
                'text-xs select-none font-normal tracking-tight whitespace-nowrap ml-auto self-end',
                msg.userId === currentUserId && !isBgTransparent
                  ? 'text-on-accent/60'
                  : 'text-on-ghost-subtle',
              ]"
            >
              {{ formatTime(msg.createdAt) }}
            </span>
          </div>

          <!-- Quick action buttons (desktop) -->
          <div
            :class="[
              'absolute top-1/2 -translate-y-1/2 opacity-0 group-hover/msg:opacity-100 flex gap-2 items-center transition-all duration-200 delay-75 scale-90 translate-y-1 group-hover/msg:scale-100 group-hover/msg:translate-y-[-50%] z-10 hidden md:flex',
              msg.userId === currentUserId
                ? 'left-[-96px] flex-row-reverse'
                : 'right-[-96px] flex-row',
            ]"
          >
            <BaseTooltip :content="t('chat.reply')" placement="bottom">
              <BaseButton :icon="Reply" @click="emit('reply', msg)" />
            </BaseTooltip>

            <BaseTooltip :content="t('common.more')" placement="bottom">
              <BaseButton
                :icon="Ellipsis"
                @click.stop="emit('menu', $event, msg)"
              />
            </BaseTooltip>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
