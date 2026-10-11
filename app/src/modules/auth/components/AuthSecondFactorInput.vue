<script setup lang="ts">
import { nextTick, useTemplateRef } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  emptySecondFactor,
  type SecondFactorDraft,
} from '@/modules/auth/utils/secondFactor';

const props = withDefaults(
  defineProps<{
    id: string;
    invalid?: boolean;
  }>(),
  { invalid: false },
);

const emit = defineEmits<{
  input: [];
  /** A complete authenticator code, which is submitted without a click. */
  complete: [];
}>();

const draft = defineModel<SecondFactorDraft>({ required: true });

const { t } = useI18n();
const field = useTemplateRef<{ focus: () => void }>('field');

async function toggleMode() {
  draft.value = emptySecondFactor(
    draft.value.mode === 'code' ? 'recoveryCode' : 'code',
  );
  emit('input');
  await nextTick();
  field.value?.focus();
}

function onRecoveryCodeInput(value: string) {
  draft.value = { mode: 'recoveryCode', value };
  emit('input');
}

defineExpose({ focus: () => field.value?.focus() });
</script>

<template>
  <div class="flex flex-col items-center gap-3">
    <BaseCodeInput
      v-if="draft.mode === 'code'"
      :id="props.id"
      ref="field"
      :model-value="draft.value"
      :aria-label="t('auth.mfa.verify.code')"
      :invalid="props.invalid"
      @update:model-value="draft = { mode: 'code', value: $event }"
      @input="emit('input')"
      @complete="emit('complete')"
    />
    <BaseInput
      v-else
      :id="props.id"
      ref="field"
      :model-value="draft.value"
      class="font-mono text-center tracking-widest uppercase"
      :aria-label="t('auth.second_factor.recovery_code')"
      :aria-invalid="props.invalid || undefined"
      :placeholder="t('auth.second_factor.recovery_code_placeholder')"
      autocomplete="one-time-code"
      autocapitalize="characters"
      autocorrect="off"
      spellcheck="false"
      maxlength="32"
      @update:model-value="onRecoveryCodeInput(String($event ?? ''))"
    />

    <button
      type="button"
      class="text-sm text-on-ghost-muted underline hover:text-on-ghost transition-colors cursor-pointer"
      @click="toggleMode"
    >
      {{
        draft.mode === 'code'
          ? t('auth.second_factor.use_recovery_code')
          : t('auth.second_factor.use_authenticator')
      }}
    </button>
  </div>
</template>
