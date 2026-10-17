import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuery } from '@tanstack/vue-query';
import { apiErrorMessage } from '@/api/errors';
import { useLoadErrorToast } from '@/common/composables/useLoadErrorToast';
import { accountSecurityQuery } from '@/modules/admin/utils/adminQueries';

/** How all accounts are secured and sign in. */
export function useAccountSecurity() {
  const { t } = useI18n();
  const query = useQuery(accountSecurityQuery());

  useLoadErrorToast(query, (error) =>
    apiErrorMessage(error, t('admin.overview.errors.load')),
  );

  return { security: computed(() => query.data.value ?? null) };
}
