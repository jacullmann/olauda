import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMfa } from './useMfa';
import { useToast } from '@/common/composables/useToast';
import {
  emptySecondFactor,
  secondFactorProof,
} from '@/modules/auth/utils/secondFactor';

/** From here on, a sign-in with a recovery code warns that few are left. */
const LOW_RECOVERY_CODES = 3;

interface MfaVerifyCallbacks {
  onVerified: () => void;
  onExpired: () => void;
}

export function useMfaVerify({ onVerified, onExpired }: MfaVerifyCallbacks) {
  const { t } = useI18n();
  const toast = useToast();
  const { verifyMfaLogin } = useMfa();

  const secondFactor = ref(emptySecondFactor());
  const submitting = ref(false);
  const error = ref('');

  const proof = computed(() => secondFactorProof(secondFactor.value));

  function warnIfFewCodesLeft(left: number | null) {
    if (left === null || left > LOW_RECOVERY_CODES) return;
    toast.warning(
      t('auth.recovery_codes.notices.running_low', { count: left }, left),
    );
  }

  async function submit() {
    if (!proof.value || submitting.value) return;
    submitting.value = true;
    error.value = '';
    try {
      const result = await verifyMfaLogin(proof.value);
      if (result.ok) {
        warnIfFewCodesLeft(result.data);
        onVerified();
      } else if (result.challengeExpired) {
        onExpired();
      } else {
        error.value = result.error ?? '';
        secondFactor.value = emptySecondFactor(secondFactor.value.mode);
      }
    } finally {
      submitting.value = false;
    }
  }

  function clearError() {
    error.value = '';
  }

  return {
    secondFactor,
    submitting,
    error,
    complete: computed(() => !!proof.value),
    submit,
    clearError,
  };
}
