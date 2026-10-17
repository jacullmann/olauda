import type { InvalidateQueryFilters, QueryClient } from '@tanstack/vue-query';
import type { GroupTopic } from '@/api/schema';
import { groupKeys } from '@/modules/groups/utils/groupQueries';

/** The views of a group the server filters by the member's courses. */
const PERSONALIZED_TOPICS: readonly GroupTopic[] = ['tasks', 'schedule'];

/** Every group's views that depend on the member's courses. */
export const personalizedViews: InvalidateQueryFilters = {
  predicate: ({ queryKey: [root, , topic] }) =>
    root === groupKeys.all[0] &&
    PERSONALIZED_TOPICS.some((personalized) => personalized === topic),
};

/** Reloads them after the courses or the choice to personalize changed. */
export function invalidatePersonalizedViews(
  queryClient: QueryClient,
): Promise<void> {
  return queryClient.invalidateQueries(personalizedViews);
}
