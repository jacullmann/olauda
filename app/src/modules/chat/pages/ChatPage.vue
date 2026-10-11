<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { MessageCircle, Info } from '@lucide/vue';
import { useChat } from '@/modules/chat/composables/useChat';
import { useIsOnScreenKeyboardOpen } from '@/common/composables/useViewport';

// Sub-components
import ChatMessageBubble from '@/modules/chat/components/ChatMessageBubble.vue';
import ChatMessageMenu from '@/modules/chat/components/ChatMessageMenu.vue';
import ChatInput from '@/modules/chat/components/ChatInput.vue';
import ChatScrollButton from '@/modules/chat/components/ChatScrollButton.vue';
import TaskReportModal from '@/modules/tasks/components/TaskReportModal.vue';

const { t } = useI18n();
const isKeyboardOpen = useIsOnScreenKeyboardOpen();

const {
  canSend,
  isMobile,
  activeMessage,
  menuRef,
  contextMenuStyles,
  openMenu,
  currentUserId,
  messages,
  loading,
  error,
  messageInput,
  replyParent,
  dismissedNewMessagesDivider,
  firstNewMessageIndex,
  showScrollBottomBtn,
  messageContainer,
  messageContent,
  viewportHeight,
  isGroupedWithPrevious,
  scrollToBottom,
  handleScroll,
  fetchMessages,
  sendMessage,
  handleInput,
  startReply,
  scrollToMessage,
  typingDisplay,
  canDeleteMessage,
  copyMessage,
  deleteMessage,
  showReportConfirm,
  reportReason,
  reportMessage,
  doReport,
  cancelReport,
} = useChat();
</script>

<template>
  <!-- Grid: the message list and the scroll button share the first row, the input sits in the second. -->
  <div
    class="chat-container grid grid-rows-[minmax(0,1fr)_auto] overflow-hidden"
    :class="{ 'is-keyboard-open': isKeyboardOpen }"
    :style="
      viewportHeight
        ? { '--chat-viewport-height': `${viewportHeight}px` }
        : undefined
    "
  >
    <div
      ref="messageContainer"
      class="row-start-1 col-start-1 overflow-y-auto overflow-x-hidden overscroll-contain py-4 custom-scrollbar bg-canvas"
      @scroll.passive="handleScroll"
    >
      <div v-if="loading" class="h-full flex justify-center items-center">
        <BaseSpinner size="32px" />
      </div>

      <div
        v-else-if="error"
        class="h-full flex flex-col justify-center items-center gap-3 text-danger p-6 text-center"
      >
        <Info :size="40" />
        <span class="text-sm font-semibold tracking-tight">{{ error }}</span>
        <BaseButton variant="ghost" on="ghost" @click="fetchMessages">
          {{ t('chat.reload') }}
        </BaseButton>
      </div>

      <div v-else ref="messageContent" class="flex min-h-full flex-col">
        <BaseEmptyState
          v-if="messages.length === 0"
          class="flex-1"
          :icon="MessageCircle"
        >
          {{ t('chat.no_messages') }}
        </BaseEmptyState>

        <TransitionGroup name="msg-list">
          <div
            v-for="(msg, index) in messages"
            :key="msg.id"
            class="flex flex-col"
          >
            <Transition name="fade">
              <div
                v-if="
                  index === firstNewMessageIndex && !dismissedNewMessagesDivider
                "
                class="flex my-6 px-4 md:px-8 select-none"
              >
                <span
                  class="mx-auto text-sm font-medium text-on-ghost bg-ghost-hover px-4 py-1.5 rounded-full"
                >
                  {{
                    messages.length >= 100 && firstNewMessageIndex === 0
                      ? '100+ ' + t('chat.new_messages')
                      : t('chat.new_messages')
                  }}
                </span>
              </div>
            </Transition>

            <ChatMessageBubble
              :msg="msg"
              :is-grouped="isGroupedWithPrevious(msg, index)"
              :current-user-id="currentUserId"
              @reply="startReply"
              @menu="openMenu"
              @scroll-to-message="scrollToMessage"
            />
          </div>
        </TransitionGroup>

        <div class="px-6 py-1 h-6 mt-4 flex items-center">
          <Transition name="fade">
            <div
              v-if="typingDisplay"
              class="flex items-center gap-2.5 text-sm text-on-ghost-muted font-bold select-none"
            >
              <div class="flex items-center gap-0.75 h-2">
                <span
                  v-for="i in 3"
                  :key="i"
                  class="w-1.5 h-1.5 bg-action rounded-full typing-dot"
                ></span>
              </div>
              <span>{{ typingDisplay }}</span>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <!-- Placed over the bottom-right of the message list (first grid row). -->
    <ChatScrollButton
      :show="showScrollBottomBtn"
      @click="scrollToBottom(true, true)"
    />

    <ChatInput
      v-model="messageInput"
      class="row-start-2"
      :reply-parent="replyParent"
      :can-send="canSend"
      @submit="sendMessage"
      @input="handleInput"
      @cancel-reply="replyParent = null"
    />

    <!-- Overlays render into <body>, so they do not take part in the grid. -->
    <ChatMessageMenu
      ref="menuRef"
      :active-message="activeMessage"
      :can-delete="activeMessage ? canDeleteMessage(activeMessage) : false"
      :context-menu-styles="contextMenuStyles"
      :is-mobile="isMobile"
      @close="activeMessage = null"
      @reply="
        (msg) => {
          startReply(msg);
          activeMessage = null;
        }
      "
      @copy="copyMessage"
      @report="reportMessage"
      @delete="deleteMessage"
    />

    <TaskReportModal
      v-model:reason="reportReason"
      :open="showReportConfirm"
      message=""
      show-reason-input
      @confirm="doReport"
      @cancel="cancelReport"
    />
  </div>
</template>

<style scoped>
/*
 * Fill the space below the header. `--chat-viewport-height` follows the visual
 * viewport so the input stays above the on-screen keyboard; `100dvh` is the fallback.
 * The bottom inset clears the tab bar, which already includes the safe area,
 * or else the safe area alone. An open keyboard covers both, so it needs neither.
 */
.chat-container {
  --chat-bottom-inset: max(
    var(--tab-bar-height, 0px),
    env(safe-area-inset-bottom, 0px)
  );

  height: calc(
    var(--chat-viewport-height, 100dvh) - var(--header-height) - 8px -
      var(--chat-bottom-inset)
  );
}

.chat-container.is-keyboard-open {
  --chat-bottom-inset: 0px;
}

@keyframes flash-message-pulse {
  0%,
  100% {
    background-color: transparent;
  }
  50% {
    background-color: var(--color-ghost-hover);
  }
}

.flash-message {
  animation: flash-message-pulse 1.8s cubic-bezier(0.16, 1, 0.3, 1) 1;
  transition: all 0.3s ease;
}

@keyframes wave-dots {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  50% {
    transform: translateY(-3.5px);
    opacity: 1;
  }
}

.typing-dot {
  animation: wave-dots 1.1s ease-in-out infinite;
}
.typing-dot:nth-child(2) {
  animation-delay: 0.18s;
}
.typing-dot:nth-child(3) {
  animation-delay: 0.36s;
}

.msg-list-enter-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.msg-list-enter-from {
  opacity: 0;
  transform: translateY(16px) scale(0.97);
}
.msg-list-move {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(3px);
}
</style>
