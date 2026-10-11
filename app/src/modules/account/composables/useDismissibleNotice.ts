import { computed } from 'vue';
import api from '@/api/client';
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

    // Hidden locally first; a failed sync only brings it back on the next load.
    void api.put(`/user/dismissed-notices/${notice}`).catch((err) => {
      console.error(
        `Failed to sync dismissed notice ${notice} to backend`,
        err,
      );
    });
  }

  return { isDismissed, dismiss };
}
