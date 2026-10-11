import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '@/api/client';
import type { SystemAnnouncement } from '@/modules/announcements/types';

/** The platform's running announcements the user has yet to read, newest first. */
export const useSystemAnnouncementStore = defineStore(
  'system-announcements',
  () => {
    const announcements = ref<SystemAnnouncement[]>([]);

    async function load() {
      try {
        const { data } = await api.get<SystemAnnouncement[]>(
          '/system-announcements',
        );
        announcements.value = data;
      } catch (e) {
        console.error('Failed to load system announcements', e);
      }
    }

    async function markRead(ids: string[]) {
      if (ids.length === 0) return;
      announcements.value = announcements.value.filter(
        (a) => !ids.includes(a.id),
      );
      try {
        await api.post('/system-announcements/read', { ids });
      } catch {
        // Already gone locally; a failed sync shows them again on the next load.
      }
    }

    function markAllRead() {
      return markRead(announcements.value.map((a) => a.id));
    }

    return { announcements, load, markRead, markAllRead };
  },
);
