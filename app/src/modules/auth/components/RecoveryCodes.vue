<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Check, Copy, Download } from '@lucide/vue';
import { useToast } from '@/common/composables/useToast';

const props = defineProps<{
  codes: string[];
}>();

const emit = defineEmits<{
  done: [];
}>();

const { t } = useI18n();
const toast = useToast();

const FILE_NAME = 'olauda-recovery-codes.txt';
const COPIED_FEEDBACK_MS = 2000;

const copied = ref(false);
const saved = ref(false);

const fileContent = computed(() =>
  [t('auth.recovery_codes.file_header'), '', ...props.codes, ''].join('\n'),
);

async function copyCodes() {
  try {
    await navigator.clipboard.writeText(props.codes.join('\n'));
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, COPIED_FEEDBACK_MS);
  } catch {
    toast.error(t('auth.recovery_codes.errors.copy'));
  }
}

function downloadCodes() {
  const url = URL.createObjectURL(
    new Blob([fileContent.value], { type: 'text/plain;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = FILE_NAME;
  link.click();
  // Firefox starts the download after the click handler; revoking right away
  // would cancel it.
  setTimeout(() => URL.revokeObjectURL(url));
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="text-sm/relaxed text-on-ghost-muted m-0! font-sans">
      {{ t('auth.recovery_codes.instruction') }}
    </p>

    <ul
      class="grid grid-cols-2 gap-x-6 gap-y-2 p-4 m-0 list-none bg-surface border border-ghost-border rounded-lg shadow-input"
      :aria-label="t('auth.recovery_codes.title')"
    >
      <li
        v-for="code in props.codes"
        :key="code"
        class="font-mono text-sm text-on-ghost tracking-wider text-center select-all"
      >
        {{ code }}
      </li>
    </ul>

    <BaseRow justify="end">
      <BaseButton variant="ghost" @click="copyCodes">
        <component :is="copied ? Check : Copy" :size="16" />
        {{ copied ? t('common.buttons.copied') : t('common.buttons.copy') }}
      </BaseButton>
      <BaseButton variant="ghost" @click="downloadCodes">
        <Download :size="16" />
        {{ t('auth.recovery_codes.download') }}
      </BaseButton>
    </BaseRow>

    <BaseCheckbox v-model="saved">
      {{ t('auth.recovery_codes.confirm_saved') }}
    </BaseCheckbox>

    <BaseButton variant="action" full :disabled="!saved" @click="emit('done')">
      {{ t('auth.recovery_codes.done') }}
    </BaseButton>
  </div>
</template>
