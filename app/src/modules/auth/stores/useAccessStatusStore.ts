import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '@/api/client';

interface AccessStatus {
  registrationOpen: boolean;
  shutdown: boolean;
}

/**
 * Whether superadmins paused sign-ups or shut the platform down,
 * for the pages to say so upfront. The server enforces both regardless.
 */
export const useAccessStatusStore = defineStore('access-status', () => {
  const registrationOpen = ref(true);
  const shutdown = ref(false);

  async function load(): Promise<void> {
    try {
      const { data } = await api.get<AccessStatus>('/system/access');
      registrationOpen.value = data.registrationOpen;
      shutdown.value = data.shutdown;
    } catch {
      // The forms stay usable; a refused request explains itself.
    }
  }

  /** A request just met shutdown, which closes sign-ups as well. */
  function enterShutdown(): void {
    shutdown.value = true;
    registrationOpen.value = false;
  }

  return { registrationOpen, shutdown, load, enterShutdown };
});
