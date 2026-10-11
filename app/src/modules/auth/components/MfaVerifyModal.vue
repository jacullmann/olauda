<script setup lang="ts">
import { computed, useTemplateRef, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import CenteredAuthModal from '@/common/components/CenteredAuthModal.vue';
import SecondFactorInput from '@/modules/auth/components/SecondFactorInput.vue';
import { useMfa } from '@/modules/auth/composables/useMfa';
import { useMfaVerify } from '@/modules/auth/composables/useMfaVerify';
import { useMfaPasskey } from '@/modules/auth/composables/useMfaPasskey';
import { passkeyIcon } from '@/modules/auth/utils/passkeyIcon';

const props = defineProps<{
  passkeyAvailable: boolean;
}>();

const emit = defineEmits<{
  verified: [];
  cancelled: [];
  expired: [];
}>();

const { t } = useI18n();
const { cancelMfaLogin } = useMfa();

const { secondFactor, submitting, error, complete, submit, clearError } =
  useMfaVerify({
    onVerified: () => emit('verified'),
    onExpired: () => emit('expired'),
  });

const {
  supported: passkeysSupported,
  verifying: passkeyVerifying,
  error: passkeyError,
  verifyWithPasskey,
  clearError: clearPasskeyError,
} = useMfaPasskey({
  onVerified: () => emit('verified'),
  onExpired: () => emit('expired'),
});

const offersPasskey = computed(
  () => props.passkeyAvailable && passkeysSupported,
);
const busy = computed(() => submitting.value || passkeyVerifying.value);

function clearErrors() {
  clearError();
  clearPasskeyError();
}

async function submitCode() {
  clearPasskeyError();
  await submit();
}

async function confirmWithPasskey() {
  clearError();
  await verifyWithPasskey();
}

const codeInput = useTemplateRef<{ focus: () => void }>('codeInput');
onMounted(() => codeInput.value?.focus());

async function cancel() {
  if (busy.value) return;
  await cancelMfaLogin();
  emit('cancelled');
}
</script>

<template>
  <CenteredAuthModal
    :title="t('auth.mfa.verify.title')"
    :close-on-backdrop="false"
    @close="cancel"
  >
    <BaseForm
      :submit="submitCode"
      :cancel="cancel"
      :error="error || passkeyError"
      :loading="busy"
      :requirement="complete"
    >
      <template #content>
        <p class="m-0! mb-4!">
          {{
            secondFactor.mode === 'code'
              ? t('auth.mfa.verify.instruction')
              : t('auth.mfa.verify.recovery_instruction')
          }}
        </p>
        <!-- Authenticator codes are typed or pasted in one go, so a complete
             code submits without an extra click. -->
        <SecondFactorInput
          id="mfa-code"
          ref="codeInput"
          v-model="secondFactor"
          :invalid="!!error"
          @input="clearErrors"
          @complete="submitCode"
        />
        <p class="m-0! mt-4! text-sm! text-on-ghost-muted">
          {{ t('auth.mfa.verify.support.text') }}
          <a
            href="mailto:contact@olauda.com"
            class="text-on-ghost underline hover:opacity-75 transition-opacity"
          >
            {{ t('auth.mfa.verify.support.link') }}
          </a>
        </p>
      </template>
    </BaseForm>
    <template v-if="offersPasskey">
      <div class="flex items-center gap-2 my-4">
        <div class="flex-1 h-px bg-ghost-border" />
        <span class="text-xs text-on-ghost-muted">
          {{ t('auth.login.or_continue_with') }}
        </span>
        <div class="flex-1 h-px bg-ghost-border" />
      </div>
      <BaseButton
        type="button"
        surface
        variant="ghost"
        class="w-full justify-center"
        :icon="passkeyIcon"
        :loading="passkeyVerifying"
        :disabled="busy"
        @click="confirmWithPasskey"
      >
        {{ t('auth.mfa.verify.with_passkey') }}
      </BaseButton>
    </template>
  </CenteredAuthModal>
</template>
