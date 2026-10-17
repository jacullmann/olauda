import { computed, toValue, type MaybeRefOrGetter } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { apiErrorStatus } from '@/api/errors';
import { adminGroupQuery } from '@/modules/admin/utils/adminQueries';

const NOT_FOUND = 404;

export type GroupDetailsState = 'loading' | 'ready' | 'not-found' | 'failed';

/**
 * A group as its admin page shows it. Another group's details never show,
 * not even dimmed while loading, as each group has its own query.
 */
export function useAdminGroup(groupId: MaybeRefOrGetter<string>) {
  const query = useQuery(computed(() => adminGroupQuery(toValue(groupId))));
  const group = computed(() => query.data.value ?? null);

  const state = computed<GroupDetailsState>(() => {
    if (group.value) return 'ready';
    if (query.isFetching.value || !query.error.value) return 'loading';
    return apiErrorStatus(query.error.value) === NOT_FOUND
      ? 'not-found'
      : 'failed';
  });

  function reload() {
    void query.refetch();
  }

  return { group, state, reload };
}
