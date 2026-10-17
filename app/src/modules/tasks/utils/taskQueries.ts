import { queryOptions, type QueryClient } from '@tanstack/vue-query';
import api, { unwrap } from '@/api/client';
import type { ItemListDto } from '@/api/schema';
import { groupKeys } from '@/modules/groups/utils/groupQueries';
import type { Task, TaskType } from '@/modules/tasks/types';

/** What the server filters a group's task list by. */
export interface TaskListParams {
  /** Every type when left out. */
  type?: TaskType;
  archived: boolean;
  subjectId?: string;
  hideChecked: boolean;
  personalized: boolean;
}

/**
 * A group's tasks sit below its `tasks` topic. The member's checks, pins and
 * archive choices span every group, so they have a root of their own.
 */
export const taskKeys = {
  all: (groupId: string) => groupKeys.topic(groupId, 'tasks'),
  lists: (groupId: string) => [...taskKeys.all(groupId), 'list'] as const,
  list: (groupId: string, params: TaskListParams) =>
    [...taskKeys.lists(groupId), params] as const,
  detail: (groupId: string, taskId: string) =>
    [...taskKeys.all(groupId), 'detail', taskId] as const,
  marks: () => ['taskMarks'] as const,
  checks: () => [...taskKeys.marks(), 'checks'] as const,
  pins: () => [...taskKeys.marks(), 'pins'] as const,
  visibility: () => [...taskKeys.marks(), 'visibility'] as const,
};

export const taskListQuery = (groupId: string, params: TaskListParams) =>
  queryOptions({
    queryKey: taskKeys.list(groupId, params),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET('/groups/{group_id}/items', {
          params: { path: { group_id: groupId }, query: params },
          signal,
        }),
      ),
  });

export const taskQuery = (groupId: string, taskId: string) =>
  queryOptions({
    queryKey: taskKeys.detail(groupId, taskId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET('/groups/{group_id}/items/{id}', {
          params: { path: { group_id: groupId, id: taskId } },
          signal,
        }),
      ),
  });

export const taskChecksQuery = () =>
  queryOptions({
    queryKey: taskKeys.checks(),
    queryFn: ({ signal }) => unwrap(api.GET('/user/checks', { signal })),
  });

export const taskPinsQuery = () =>
  queryOptions({
    queryKey: taskKeys.pins(),
    queryFn: ({ signal }) => unwrap(api.GET('/user/pins', { signal })),
  });

export const taskVisibilityQuery = () =>
  queryOptions({
    queryKey: taskKeys.visibility(),
    queryFn: ({ signal }) => unwrap(api.GET('/user/visibility', { signal })),
  });

/** Applies a change the server confirmed to every loaded copy of the task. */
export function updateCachedTask(
  queryClient: QueryClient,
  groupId: string,
  taskId: string,
  change: Partial<Task>,
): void {
  queryClient.setQueriesData<ItemListDto>(
    { queryKey: taskKeys.lists(groupId) },
    (list) =>
      list && {
        ...list,
        items: list.items.map((task) =>
          task.id === taskId ? { ...task, ...change } : task,
        ),
      },
  );
  queryClient.setQueryData<Task>(
    taskKeys.detail(groupId, taskId),
    (task) => task && { ...task, ...change },
  );
}

/** Drops a deleted task from every loaded list, ahead of their reload. */
export function removeCachedTask(
  queryClient: QueryClient,
  groupId: string,
  taskId: string,
): void {
  queryClient.removeQueries({ queryKey: taskKeys.detail(groupId, taskId) });
  queryClient.setQueriesData<ItemListDto>(
    { queryKey: taskKeys.lists(groupId) },
    (list) =>
      list && {
        ...list,
        items: list.items.filter((task) => task.id !== taskId),
      },
  );
}
