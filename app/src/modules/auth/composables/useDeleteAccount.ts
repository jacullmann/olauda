import { ref } from 'vue';
import api from '@/api/api.ts';
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
      const res = await api.delete('/auth/me');
      if (res?.data?.ok) {
        toast.success(t('auth.delete_account.success'));
        emit('deleted');
      } else {
        errorMsg.value = t('auth.delete_account.errors.delete');
        emit('error', errorMsg.value);
      }
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
