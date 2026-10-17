import { queryOptions } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';

export const todoKeys = {
  all: ['todos'] as const,
};

/** The user's private todos, sorted by their position. */
export const todosQuery = () =>
  queryOptions({
    queryKey: todoKeys.all,
    queryFn: ({ signal }) => unwrap(api.GET('/todos', { signal })),
  });
