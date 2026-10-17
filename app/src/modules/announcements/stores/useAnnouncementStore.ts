import { defineStore } from 'pinia';
import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import { queryClient } from '@/api/queryClient';
import type { Announcement } from '@/modules/announcements/types';
import { useGroups } from '@/modules/groups/composables/useGroups';
import {
  announcementKeys,
  groupAnnouncementsQuery,
} from '@/modules/announcements/utils/announcementQueries';

/** Announcements of the group on screen, newest first. */
export const useAnnouncementStore = defineStore('announcements', () => {
  const { activeGroupId } = useGroups();

  const query = useQuery(
    computed(() => ({
      ...groupAnnouncementsQuery(activeGroupId.value ?? ''),
      enabled: !!activeGroupId.value,
    })),
    queryClient,
  );

  const announcements = computed<Announcement[]>(() =>
    activeGroupId.value ? (query.data.value ?? []) : [],
  );
  const unread = computed(() => announcements.value.filter((a) => !a.read));

  async function markRead(ids: string[]) {
    const groupId = activeGroupId.value;
    if (!groupId || ids.length === 0) return;
    const key = announcementKeys.group(groupId);
    // A load still on its way would bring them back as unread.
    void queryClient.cancelQueries({ queryKey: key });
    queryClient.setQueryData<Announcement[]>(key, (current) =>
      current?.map((a) => (ids.includes(a.id) ? { ...a, read: true } : a)),
    );
    try {
      await unwrap(
        api.POST('/groups/{group_id}/announcements/read', {
          params: { path: { group_id: groupId } },
          body: { ids },
        }),
      );
    } catch {
      // Already marked locally; a failed sync shows them again on the next load.
    }
  }

  function markAllRead() {
    return markRead(unread.value.map((a) => a.id));
  }

  return { announcements, unread, markRead, markAllRead };
});
