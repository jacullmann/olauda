import { describe, expect, it } from 'vitest';
import type { Lesson, Substitution } from '@/modules/schedule/types';
import { withSubstitutions } from './substitutions';

function lesson(id: string, extra: Partial<Lesson> = {}): Lesson {
  return {
    id,
    day: 1,
    slot: 1,
    duration: 1,
    room: 'A1',
    isDalton: false,
    ...extra,
  };
}

function sub(
  lessonId: string,
  extra: Partial<Substitution> = {},
): Substitution {
  return {
    id: `sub-${lessonId}`,
    lessonId,
    weekStart: '2024-01-01',
    cancelled: false,
    createdAt: '2024-01-01',
    ...extra,
  };
}

describe('withSubstitutions', () => {
  it('keeps unchanged lessons and their original', () => {
    const [result] = withSubstitutions([lesson('a')], []);
    expect(result?.room).toBe('A1');
    expect(result?._original?.id).toBe('a');
  });

  it('applies the set fields of a change', () => {
    const [result] = withSubstitutions(
      [lesson('a')],
      [sub('a', { room: 'B2', subject: 'Math', cancelled: true })],
    );
    expect(result).toMatchObject({
      room: 'B2',
      subject: 'Math',
      isSubstitutedSubject: true,
      cancelled: true,
    });
    expect(result?._original?.room).toBe('A1');
  });

  it('lets the latest of several changes win', () => {
    const [result] = withSubstitutions(
      [lesson('a')],
      [
        sub('a', { room: 'new', createdAt: '2024-01-02' }),
        sub('a', { room: 'old', createdAt: '2024-01-01' }),
      ],
    );
    expect(result?.room).toBe('new');
  });

  it('matches a split lesson by its original id and course', () => {
    const lessons = [
      lesson('a_c1', { _originalId: 'a', courseId: 'c1' }),
      lesson('a_c2', { _originalId: 'a', courseId: 'c2' }),
    ];
    const [first, second] = withSubstitutions(lessons, [
      sub('a', { courseId: 'c2', room: 'B2' }),
    ]);
    expect(first?.room).toBe('A1');
    expect(second?.room).toBe('B2');
  });
});
