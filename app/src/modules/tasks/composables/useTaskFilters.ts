import { computed, ref, watch } from 'vue';
import { useRoute, useRouter, type LocationQuery } from 'vue-router';
import { isValidType, type ItemType } from '@/modules/tasks/types';
import { isUuid } from '@/common/utils/uuid';

export interface TaskFilters {
  tab: ItemType;
  showOldEntries: boolean;
  subject: string;
  hideChecked: boolean;
}

function filtersFromQuery(query: LocationQuery): TaskFilters {
  return {
    tab: isValidType(query.type) ? query.type : 'all',
    showOldEntries: query.archived === 'true',
    // Links from before tasks referenced subjects by id carry a subject name.
    subject: isUuid(query.subject) ? query.subject : '',
    hideChecked: query.hideChecked === 'true',
  };
}

function queryFromFilters(filters: TaskFilters): LocationQuery {
  const query: LocationQuery = {};
  if (filters.tab !== 'all') query.type = filters.tab;
  if (filters.showOldEntries) query.archived = 'true';
  if (filters.subject) query.subject = filters.subject;
  if (filters.hideChecked) query.hideChecked = 'true';
  return query;
}

/** `fixedFilters` take precedence over the filters in the URL. */
export function useTaskFilters(fixedFilters: Partial<TaskFilters>) {
  const route = useRoute();
  const router = useRouter();
  const isListRoute = computed(() => route.name === 'group-tasks');

  const initialFilters = { ...filtersFromQuery(route.query), ...fixedFilters };
  const tab = ref<ItemType>(initialFilters.tab);
  const showOldEntries = ref(initialFilters.showOldEntries);
  const subjectFilter = ref(initialFilters.subject);
  const hideChecked = ref(initialFilters.hideChecked);

  const filters = computed<TaskFilters>(() => ({
    tab: tab.value,
    showOldEntries: showOldEntries.value,
    subject: subjectFilter.value,
    hideChecked: hideChecked.value,
  }));

  function goTab(type: ItemType) {
    tab.value = type;
  }

  function resetFilters() {
    subjectFilter.value = '';
    showOldEntries.value = false;
    hideChecked.value = false;
    goTab('all');
  }

  // The filters live in the list's URL. An opened task has a URL of its own,
  // so they keep their values behind it and the list comes back unchanged.
  watch(
    () => route.query,
    (query) => {
      if (!isListRoute.value) return;
      const fromQuery = filtersFromQuery(query);
      tab.value = fromQuery.tab;
      showOldEntries.value = fromQuery.showOldEntries;
      subjectFilter.value = fromQuery.subject;
      hideChecked.value = fromQuery.hideChecked;
    },
  );

  watch(filters, (current) => {
    if (!isListRoute.value) return;
    void router.replace({ query: queryFromFilters(current) });
  });

  return {
    tab,
    showOldEntries,
    subjectFilter,
    hideChecked,
    filters,
    goTab,
    resetFilters,
  };
}
