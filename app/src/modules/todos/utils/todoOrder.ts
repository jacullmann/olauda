import type { Todo } from '@/modules/todos/types';

/**
 * A key that sorts strictly between two positions, so a moved task lands in
 * its slot straight away instead of wherever a guessed key happens to sort
 * until the server answers with the real one. Appending a character, as the
 * obvious shortcut, sorts after the key it extends and can overshoot the
 * neighbour on the other side.
 */
export function positionBetween(
  prev: string | null,
  next: string | null,
): string {
  const lower = prev ?? '';
  let upper = next;
  let key = '';

  for (let i = 0; i < lower.length + (upper?.length ?? 0) + 1; i++) {
    const lo = i < lower.length ? lower.charCodeAt(i) : 0;
    const hi =
      upper !== null && i < upper.length ? upper.charCodeAt(i) : 0x10000;

    if (lo === hi) {
      key += String.fromCharCode(lo);
      continue;
    }

    const mid = (lo + hi) >> 1;
    if (mid > lo) return key + String.fromCharCode(mid);

    // Adjacent characters leave no room here; anything after `lower` at this
    // depth already sorts below `upper`.
    key += String.fromCharCode(lo);
    upper = null;
  }

  return key;
}

/**
 * The list order: by position, then todos without one (from before the
 * list could be arranged), open ones first and the newest first among them.
 */
export function sortTodos(todos: readonly Todo[]): Todo[] {
  return todos.toSorted((a, b) => {
    if (a.position && b.position) {
      return a.position < b.position ? -1 : a.position > b.position ? 1 : 0;
    }
    if (a.position) return -1;
    if (b.position) return 1;
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}
