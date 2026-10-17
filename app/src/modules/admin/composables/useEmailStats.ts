import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useQuery } from '@tanstack/vue-query';
import type { ErrorCode } from '@/api/schema';
import { apiErrorCode, apiErrorMessage } from '@/api/errors';
import { useLoadErrorToast } from '@/common/composables/useLoadErrorToast';
import {
  emailActivityQuery,
  emailQuotaQuery,
} from '@/modules/admin/utils/adminQueries';

/** Why Resend's numbers could not be loaded, told apart where an admin can act on it. */
type EmailStatsFailure =
  'not_configured' | 'key_rejected' | 'unreachable' | 'load';

const FAILURE_BY_CODE: Partial<Record<ErrorCode, EmailStatsFailure>> = {
  RESEND_NOT_CONFIGURED: 'not_configured',
  RESEND_KEY_REJECTED: 'key_rejected',
  RESEND_UNREACHABLE: 'unreachable',
};

function failureOf(error: unknown): EmailStatsFailure {
  const code = apiErrorCode(error);
  return (code && FAILURE_BY_CODE[code]) || 'load';
}

/**
 * What Resend reports about the emails sent: this month's quota and the last
 * days' activity. Both are read live from Resend through the API, each on its
 * own so one failing leaves the other on screen.
 */
export function useEmailStats() {
  const { t } = useI18n();

  const activityQuery = useQuery(emailActivityQuery());
  const quotaQuery = useQuery(emailQuotaQuery());

  // Both requests usually fail for the same reason, which is told once.
  useLoadErrorToast(
    {
      error: computed(
        () => activityQuery.error.value ?? quotaQuery.error.value,
      ),
      isLoadingError: computed(
        () =>
          activityQuery.isLoadingError.value || quotaQuery.isLoadingError.value,
      ),
      isSuccess: computed(
        () => activityQuery.isSuccess.value && quotaQuery.isSuccess.value,
      ),
    },
    (error) =>
      apiErrorMessage(
        error,
        t(`admin.overview.emails.errors.${failureOf(error)}`),
      ),
  );

  return {
    activity: computed(() => activityQuery.data.value ?? null),
    quota: computed(() => quotaQuery.data.value ?? null),
  };
}
