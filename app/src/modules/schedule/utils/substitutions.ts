import type { Lesson, Substitution } from '@/modules/schedule/types';

const isSet = <T>(value: T | null | undefined | ''): value is T =>
  value !== null && value !== undefined && value !== '';

/** The lesson as its change turns it out, keeping the original to compare. */
export function applySubstitution(original: Lesson, sub: Substitution): Lesson {
  const merged: Lesson = { ...original, _original: original };
  if (isSet(sub.day)) merged.day = sub.day;
  if (isSet(sub.slot)) merged.slot = sub.slot;
  if (isSet(sub.duration)) merged.duration = sub.duration;
  if (isSet(sub.room)) merged.room = sub.room;
  if (sub.cancelled) merged.cancelled = true;
  if (isSet(sub.subject)) {
    merged.subject = sub.subject;
    merged.isSubstitutedSubject = true;
  }
  return merged;
}

/*
 * A lesson carries at most one change a week. Should the server still hand
 * over several, the latest wins, so a lesson never shows up twice.
 */
function latestSubstitutionByLesson(
  subs: readonly Substitution[],
): Map<string, Substitution> {
  const byLesson = new Map<string, Substitution>();
  subs.forEach((sub) => {
    const current = byLesson.get(sub.lessonId);
    if (!current || sub.createdAt >= current.createdAt) {
      byLesson.set(sub.lessonId, sub);
    }
  });
  return byLesson;
}

/** A week's lessons with its changes applied; each keeps its original. */
export function withSubstitutions(
  lessons: readonly Lesson[],
  subs: readonly Substitution[],
): Lesson[] {
  const substitutionByLesson = latestSubstitutionByLesson(subs);
  return lessons.map((original) => {
    const sub = substitutionByLesson.get(original._originalId || original.id);
    const applies =
      sub && (!sub.courseId || sub.courseId === original.courseId);
    return applies
      ? applySubstitution(original, sub)
      : { ...original, _original: original };
  });
}
