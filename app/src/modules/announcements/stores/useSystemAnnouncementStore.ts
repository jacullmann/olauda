import { defineStore } from 'pinia';
import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { queryClient } from '@/api/queryClient';
import type { SystemAnnouncement } from '@/modules/announcements/types';
import { useSession } from '@/modules/auth/composables/useSession';
import {
  announcementKeys,
  systemAnnouncementsQuery,
} from '@/modules/announcements/utils/announcementQueries';

/** The platform's running announcements the user has yet to read, newest first. */
export const useSystemAnnouncementStore = defineStore(
  'system-announcements',
  () => {
    const { isLoggedIn } = useSession();

    const query = useQuery(
      { ...systemAnnouncementsQuery(), enabled: isLoggedIn },
      queryClient,
    );

    const announcements = computed<SystemAnnouncement[]>(() =>
      isLoggedIn.value ? (query.data.value ?? []) : [],
    );

    async function markRead(ids: string[]) {
      if (ids.length === 0) return;
      // A load still on its way would bring them back.
      void queryClient.cancelQueries({ queryKey: announcementKeys.system() });
      queryClient.setQueryData<SystemAnnouncement[]>(
        announcementKeys.system(),
        (current) => current?.filter((a) => !ids.includes(a.id)),
      );
      try {
        await unwrap(api.POST('/system-announcements/read', { body: { ids } }));
      } catch {
        // Already gone locally; a failed sync shows them again on the next load.
      }
    }

    function markAllRead() {
      return markRead(announcements.value.map((a) => a.id));
    }

    return { announcements, markRead, markAllRead };
  },
);
