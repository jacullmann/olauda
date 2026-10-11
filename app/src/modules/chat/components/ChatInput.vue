<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { X, SendHorizontal } from '@lucide/vue';

const { t } = useI18n();

interface ReplyParentMessage {
  id: string;
  senderName: string;
  content: string;
}

const props = defineProps<{
  modelValue: string;
  replyParent: ReplyParentMessage | null;
  canSend: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: string): void;
  (e: 'submit'): void;
  (e: 'input', event: Event): void;
  (e: 'cancelReply'): void;
}>();

const textVal = computed({
  get: () => props.modelValue,
  set: (val: string) => emit('update:modelValue', val),
});

const handleInput = (e: Event) => {
  const target = e.target as HTMLTextAreaElement;
  target.style.height = 'auto';
  target.style.height = `${Math.min(target.scrollHeight, 150)}px`;
  emit('input', e);
};
</script>

<template>
  <div class="shrink-0">
    <form
      novalidate
      class="p-2 pt-0 flex items-end gap-2"
      @submit.prevent="emit('submit')"
    >
      <div
        class="flex-1 min-w-0 relative flex flex-col items-stretch py-2.25 px-2.25 min-h-10 bg-surface border border-ghost-border focus-within:border-focus focus-within:shadow-focus-ring rounded-2xl transition-all duration-200"
        :class="replyParent ? 'rounded-t-xl' : ''"
      >
        <!-- Quoted message reply header -->
        <Transition name="slide-up">
          <div
            v-if="replyParent"
            class="relative overflow-hidden flex mb-2 px-3 py-2 text-sm rounded-md transition-all duration-150 cursor-pointer select-none max-w-full w-full min-w-0 bg-ghost-hover before:content-[''] before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-on-ghost-muted text-on-ghost-muted"
          >
            <div class="flex-1 min-w-0 flex flex-col justify-center pl-1">
              <span class="text-sm font-bold text-on-ghost truncate">
                {{ replyParent.senderName }}
              </span>
              <span class="text-sm font-normal text-on-ghost-muted truncate">
                {{ replyParent.content }}
              </span>
            </div>
            <BaseButton
              class="p-1.5 hover:text-on-ghost hover:bg-ghost-hover/80 rounded-full transition-all duration-150 shrink-0"
              :title="t('chat.cancel_reply')"
              variant="ghost"
              on="ghost"
              :icon="X"
              @click="emit('cancelReply')"
            />
          </div>
        </Transition>

        <textarea
          id="chat-input-field"
          v-model="textVal"
          rows="1"
          class="w-full flex-1 items-center justify-center py-0 px-1.75 rounded-none bg-transparent border-none shadow-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 text-base/5 text-on-ghost placeholder:text-on-ghost-subtle resize-none font-normal overflow-hidden"
          :placeholder="
            canSend ? t('chat.placeholder') : t('chat.placeholder_disabled')
          "
          required
          maxlength="1000"
          :disabled="!canSend"
          @input="handleInput"
          @keydown.enter.exact.prevent="emit('submit')"
        ></textarea>
      </div>

      <BaseButton
        variant="action"
        on="ghost"
        type="submit"
        :disabled="!textVal.trim() || !canSend"
        :icon="SendHorizontal"
      />
    </form>
  </div>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    max-height 0.25s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.2s ease,
    padding 0.2s ease,
    margin 0.2s ease;
  max-height: 80px;
  overflow: hidden;
}

.slide-up-enter-from,
.slide-up-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  margin-top: 0 !important;
  margin-bottom: 0 !important;
}
</style>
