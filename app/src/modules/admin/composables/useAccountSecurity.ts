import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/client';
import { useToast } from '@/common/composables/useToast';
import type { AccountSecurity } from '@/modules/admin/types';

/** How all accounts are secured and sign in, fetched whenever the overview opens. */
export function useAccountSecurity() {
  const { t } = useI18n();
  const toast = useToast();
  const security = ref<AccountSecurity | null>(null);

  async function load() {
    try {
      const { data } = await api.get<AccountSecurity>(
        '/admin/stats/account-security',
      );
      security.value = data;
    } catch {
      toast.error(t('admin.overview.errors.load'));
    }
  }

  return { security, load };
}
