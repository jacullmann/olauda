import axios from 'axios';
import { onScopeDispose, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '@/api/client';
import { apiErrorCode } from '@/api/errors';
import { useToast } from '@/common/composables/useToast';
import type { EmailActivity, EmailQuota } from '@/modules/admin/types';

/** Why Resend's numbers could not be loaded, told apart where an admin can act on it. */
type EmailStatsFailure =
  'not_configured' | 'key_rejected' | 'unreachable' | 'load';

const FAILURE_BY_CODE: Partial<Record<string, EmailStatsFailure>> = {
  RESEND_NOT_CONFIGURED: 'not_configured',
  RESEND_KEY_REJECTED: 'key_rejected',
  RESEND_UNREACHABLE: 'unreachable',
};

const failureOf = (error: unknown): EmailStatsFailure =>
  FAILURE_BY_CODE[apiErrorCode(error) ?? ''] ?? 'load';

/**
 * What Resend reports about the emails sent: this month's quota and the last
 * days' activity. Both are read live from Resend through the API, each on its
 * own so one failing leaves the other on screen.
 */
export function useEmailStats() {
  const { t } = useI18n();
  const toast = useToast();

  const activity = ref<EmailActivity | null>(null);
  const quota = ref<EmailQuota | null>(null);

  const controller = new AbortController();
  onScopeDispose(() => controller.abort());

  async function load() {
    const config = { signal: controller.signal };
    const [activityResult, quotaResult] = await Promise.allSettled([
      api.get<EmailActivity>('/admin/emails/activity', config),
      api.get<EmailQuota>('/admin/emails/quota', config),
    ]);

    if (activityResult.status === 'fulfilled') {
      activity.value = activityResult.value.data;
    }
    if (quotaResult.status === 'fulfilled')
      quota.value = quotaResult.value.data;

    // Both requests usually fail for the same reason, which is told once.
    const failure = [activityResult, quotaResult].find(
      (result) =>
        result.status === 'rejected' && !axios.isCancel(result.reason),
    );
    if (failure?.status === 'rejected') {
      toast.error(
        t(`admin.overview.emails.errors.${failureOf(failure.reason)}`),
      );
    }
  }

  return { activity, quota, load };
}
