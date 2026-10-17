import { ref } from 'vue';
import api, { unwrap } from '@/api/client';
import { useI18n } from 'vue-i18n';
import { authErrorMessage } from '@/modules/auth/utils/authErrors';
import { useToast } from '@/common/composables/useToast';

export function useDeleteAccount(emit: {
  (e: 'cancel'): void;
  (e: 'deleted'): void;
  (e: 'error', msg: string): void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const understoodChecked = ref(false);
  const submitting = ref(false);
  const errorMsg = ref('');

  async function confirmDelete() {
    submitting.value = true;
    errorMsg.value = '';
    try {
      await unwrap(api.DELETE('/auth/me'));
      toast.success(t('auth.delete_account.success.delete'));
      emit('deleted');
    } catch (e: unknown) {
      const msg = authErrorMessage(e, t('auth.delete_account.errors.delete'));
      errorMsg.value = msg;
      if (msg) emit('error', msg);
    } finally {
      submitting.value = false;
    }
  }

  return {
    understoodChecked,
    submitting,
    errorMsg,
    confirmDelete,
  };
}
