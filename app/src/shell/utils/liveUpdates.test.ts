import { describe, expect, it } from 'vitest';
import { QueryClient, type QueryKey } from '@tanstack/vue-query';
import type { Event as LiveEvent } from '@/api/schema';
import { invalidationsFor } from './liveUpdates';

const GROUP = '7d1f4c1e-6c35-4f4f-9a43-2a4d6a1f0c11';
const OTHER_GROUP = '0b5a9c9e-1f8e-4c2b-a2f4-3f6e8d7c5b22';

const CACHED: QueryKey[] = [
  ['session'],
  ['account', 'me'],
  ['account', 'passkeys'],
  ['todos'],
  ['taskMarks', 'checks'],
  ['systemAnnouncements'],
  ['groups', GROUP, 'tasks', 'list', { archived: false }],
  ['groups', GROUP, 'schedule', 'lessons'],
  ['groups', GROUP, 'members', 'list'],
  ['groups', GROUP, 'announcements', 'list'],
  ['groups', OTHER_GROUP, 'tasks', 'list', { archived: false }],
  ['groups', OTHER_GROUP, 'schedule', 'lessons'],
];

/** The cached keys a live update marks stale. */
function invalidatedBy(event: LiveEvent): QueryKey[] {
  const client = new QueryClient();
  for (const key of CACHED) client.setQueryData(key, 'loaded');
  const cache = client.getQueryCache();
  const hit = new Set(
    invalidationsFor(event).flatMap((filters) =>
      cache.findAll(filters).map(({ queryHash }) => queryHash),
    ),
  );
  return cache
    .getAll()
    .filter(({ queryHash }) => hit.has(queryHash))
    .map(({ queryKey }) => queryKey);
}

describe('invalidationsFor', () => {
  it('reloads only the topic of the group that changed', () => {
    expect(
      invalidatedBy({ scope: 'group', groupId: GROUP, topic: 'tasks' }),
    ).toEqual([['groups', GROUP, 'tasks', 'list', { archived: false }]]);
  });

  it('reloads the session when a membership or setting of a group changed', () => {
    expect(
      invalidatedBy({ scope: 'group', groupId: GROUP, topic: 'members' }),
    ).toEqual([['session'], ['groups', GROUP, 'members', 'list']]);
  });

  it('reloads the views a course choice filters, and the profile', () => {
    expect(
      invalidatedBy({ scope: 'group', groupId: GROUP, topic: 'courses' }),
    ).toEqual([
      ['session'],
      ['account', 'me'],
      ['groups', GROUP, 'tasks', 'list', { archived: false }],
      ['groups', GROUP, 'schedule', 'lessons'],
    ]);
  });

  it('reloads the session when the courses on offer changed', () => {
    expect(
      invalidatedBy({ scope: 'group', groupId: GROUP, topic: 'subjects' }),
    ).toEqual([
      ['session'],
      ['groups', GROUP, 'tasks', 'list', { archived: false }],
      ['groups', GROUP, 'schedule', 'lessons'],
    ]);
  });

  it('reloads the marked tasks of the group and the marks themselves', () => {
    expect(
      invalidatedBy({ scope: 'group', groupId: GROUP, topic: 'taskMarks' }),
    ).toEqual([
      ['taskMarks', 'checks'],
      ['groups', GROUP, 'tasks', 'list', { archived: false }],
    ]);
  });

  it('reloads every personalized view when the profile changed', () => {
    expect(invalidatedBy({ scope: 'account', topic: 'profile' })).toEqual([
      ['account', 'me'],
      ['groups', GROUP, 'tasks', 'list', { archived: false }],
      ['groups', GROUP, 'schedule', 'lessons'],
      ['groups', OTHER_GROUP, 'tasks', 'list', { archived: false }],
      ['groups', OTHER_GROUP, 'schedule', 'lessons'],
    ]);
  });

  it('reloads the whole account after a security change', () => {
    expect(invalidatedBy({ scope: 'account', topic: 'security' })).toEqual([
      ['account', 'me'],
      ['account', 'passkeys'],
    ]);
  });

  it('reloads everything after a resync', () => {
    expect(invalidatedBy({ scope: 'resync' })).toHaveLength(CACHED.length);
  });
});
