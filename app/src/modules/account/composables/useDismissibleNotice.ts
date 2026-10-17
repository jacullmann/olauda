import { computed } from 'vue';
import api, { unwrap } from '@/api/client';
import {
  useUserStore,
  type DismissibleNotice,
} from '@/modules/account/stores/useUserStore';

export function useDismissibleNotice(notice: DismissibleNotice) {
  const userStore = useUserStore();

  const isDismissed = computed(() => userStore.isNoticeDismissed(notice));

  function dismiss(): void {
    if (!userStore.isLoggedIn || isDismissed.value) return;

    userStore.markNoticeDismissed(notice);

    // Hidden locally first; a failed save only brings it back on the next load.
    unwrap(
      api.PUT('/user/dismissed-notices/{notice}', {
        params: { path: { notice } },
      }),
    ).catch(() => undefined);
  }

  return { isDismissed, dismiss };
}
