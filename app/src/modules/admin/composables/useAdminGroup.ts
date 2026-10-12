import { ref, toValue, watch, type MaybeRefOrGetter } from 'vue';
import axios from 'axios';
import api from '@/api/client';
import { apiErrorStatus } from '@/api/errors';
import type { AdminGroup } from '@/modules/admin/types';

const NOT_FOUND = 404;

export type GroupDetailsState = 'loading' | 'ready' | 'not-found' | 'failed';

/** A group as its admin page shows it. */
export function useAdminGroup(groupId: MaybeRefOrGetter<string>) {
  const group = ref<AdminGroup | null>(null);
  const state = ref<GroupDetailsState>('loading');

  let controller: AbortController | null = null;

  async function load() {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    state.value = 'loading';

    try {
      const { data } = await api.get<AdminGroup>(
        `/admin/groups/${toValue(groupId)}`,
        { signal: current.signal },
      );
      group.value = data;
      state.value = 'ready';
    } catch (error) {
      if (axios.isCancel(error)) return;
      state.value =
        apiErrorStatus(error) === NOT_FOUND ? 'not-found' : 'failed';
    }
  }

  // Another group's details must never show, not even dimmed while loading.
  watch(
    () => toValue(groupId),
    () => {
      group.value = null;
      void load();
    },
    { immediate: true },
  );

  return { group, state, reload: load };
}
