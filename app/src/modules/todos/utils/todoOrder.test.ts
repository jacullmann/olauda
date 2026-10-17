import { describe, expect, it } from 'vitest';
import type { Todo } from '@/modules/todos/types';
import { positionBetween, sortTodos } from './todoOrder';

const todo = (
  id: string,
  position: string,
  { completed = false, createdAt = '2026-01-01T00:00:00Z' } = {},
): Todo => ({
  id,
  title: id,
  description: '',
  completed,
  position,
  createdAt,
  updatedAt: createdAt,
});

describe('positionBetween', () => {
  it.each([
    ['a', 'c'],
    ['a', 'b'],
    ['az', 'b'],
    ['a', 'a0'],
  ])('sorts between %s and %s', (prev, next) => {
    const key = positionBetween(prev, next);
    expect(key > prev).toBe(true);
    expect(key < next).toBe(true);
  });

  it('sorts after the last position', () => {
    expect(positionBetween('m', null) > 'm').toBe(true);
  });

  it('sorts before the first position', () => {
    const key = positionBetween(null, 'b');
    expect(key < 'b').toBe(true);
  });
});

describe('sortTodos', () => {
  it('orders by position', () => {
    const sorted = sortTodos([todo('c', 'c'), todo('a', 'a'), todo('b', 'b')]);
    expect(sorted.map(({ id }) => id)).toEqual(['a', 'b', 'c']);
  });

  it('puts todos without a position last, open and newest first', () => {
    const sorted = sortTodos([
      todo('done', '', { completed: true }),
      todo('older', '', { createdAt: '2026-01-01T00:00:00Z' }),
      todo('placed', 'a'),
      todo('newer', '', { createdAt: '2026-02-01T00:00:00Z' }),
    ]);
    expect(sorted.map(({ id }) => id)).toEqual([
      'placed',
      'newer',
      'older',
      'done',
    ]);
  });
});
