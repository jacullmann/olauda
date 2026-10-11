import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import api from '@/api/client';
import { groupPath } from '@/api/groupPath';
import { useAnnouncementFormModal } from './useAnnouncementFormModal';
import type { Announcement } from '@/modules/announcements/types';

/** Announcements of the group on screen, newest first. */
export const useAnnouncementStore = defineStore('announcements', () => {
  const groupId = ref<string | null>(null);
  const announcements = ref<Announcement[]>([]);

  const unread = computed(() => announcements.value.filter((a) => !a.read));

  async function load(target: string) {
    if (groupId.value !== target) {
      groupId.value = target;
      announcements.value = [];
    }
    try {
      const { data } = await api.get<Announcement[]>(
        groupPath(target, '/announcements'),
      );
      // A newer load for another group wins over this late response.
      if (groupId.value !== target) return;
      announcements.value = data;
    } catch (e) {
      console.error('Failed to load announcements', e);
    }
  }

  async function markRead(ids: string[]) {
    const target = groupId.value;
    if (!target || ids.length === 0) return;
    for (const announcement of announcements.value) {
      if (ids.includes(announcement.id)) announcement.read = true;
    }
    try {
      await api.post(groupPath(target, '/announcements/read'), { ids });
    } catch {
      // Already marked locally; a failed sync shows them again on the next load.
    }
  }

  function markAllRead() {
    return markRead(unread.value.map((a) => a.id));
  }

  function remove(id: string) {
    announcements.value = announcements.value.filter((a) => a.id !== id);
  }

  const announcementForm = useAnnouncementFormModal();
  announcementForm.onSuccess(() => {
    const target = announcementForm.payload?.groupId;
    if (target && target === groupId.value) void load(target);
  });

  return { announcements, unread, load, markRead, markAllRead, remove };
});
