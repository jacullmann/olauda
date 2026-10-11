import { lessonSpan } from '@/modules/schedule/utils/lesson';

/** Course ids per subject id that a member could still attend. */
export type CourseCandidates = ReadonlyMap<string, readonly string[]>;

/** The course a member picked, per subject id. */
export type CoursePicks = ReadonlyMap<string, string>;

export interface CourseLesson {
  courseId?: string | null;
  day: number;
  slot: number;
  duration?: number | null;
}

/**
 * - `locked`: the only course the chosen level leaves.
 * - `picked`: chosen by the member.
 * - `implied`: the only one left once everything chosen is accounted for.
 * - `open`: still possible.
 * - `excluded`: clashes with a course the member attends.
 */
export type CourseState = 'locked' | 'picked' | 'implied' | 'open' | 'excluded';

interface CourseGraph {
  subjectOf: ReadonlyMap<string, string>;
  /** Two courses of one subject, or two that meet at the same time. */
  conflicts: (a: string, b: string) => boolean;
}

export interface CourseResolution {
  /** The course each resolved subject ends up with. */
  chosen: ReadonlyMap<string, string>;
  states: ReadonlyMap<string, CourseState>;
}

const slotKey = (day: number, slot: number) => `${day}-${slot}`;

function buildCourseGraph(
  candidates: CourseCandidates,
  lessons: readonly CourseLesson[],
): CourseGraph {
  const subjectOf = new Map<string, string>();
  for (const [subjectId, courseIds] of candidates) {
    for (const courseId of courseIds) subjectOf.set(courseId, subjectId);
  }

  const slotsOf = new Map<string, Set<string>>();
  for (const lesson of lessons) {
    if (!lesson.courseId || !subjectOf.has(lesson.courseId)) continue;
    const slots = slotsOf.get(lesson.courseId) ?? new Set<string>();
    for (let offset = 0; offset < lessonSpan(lesson); offset++) {
      slots.add(slotKey(Number(lesson.day), Number(lesson.slot) + offset));
    }
    slotsOf.set(lesson.courseId, slots);
  }

  const conflicts = (a: string, b: string): boolean => {
    if (a === b) return false;
    const subject = subjectOf.get(a);
    if (subject !== undefined && subject === subjectOf.get(b)) return true;
    const slotsA = slotsOf.get(a);
    const slotsB = slotsOf.get(b);
    if (!slotsA || !slotsB) return false;
    for (const slot of slotsA) {
      if (slotsB.has(slot)) return true;
    }
    return false;
  };

  return { subjectOf, conflicts };
}

/**
 * Settles every subject it can: a level with a single course settles itself,
 * then the member's picks, then any subject whose other courses all clash with
 * what is settled so far, until nothing changes. Picks that clash with an
 * earlier choice are ignored.
 */
function resolveCourses(
  graph: CourseGraph,
  candidates: CourseCandidates,
  picks: CoursePicks,
): CourseResolution {
  const chosen = new Map<string, string>();
  const states = new Map<string, CourseState>();

  const isRuledOut = (courseId: string) =>
    [...chosen.values()].some((settled) => graph.conflicts(settled, courseId));

  const choose = (subjectId: string, courseId: string, state: CourseState) => {
    chosen.set(subjectId, courseId);
    states.set(courseId, state);
  };

  for (const [subjectId, [only, ...others]] of candidates) {
    if (only !== undefined && others.length === 0) {
      choose(subjectId, only, 'locked');
    }
  }

  for (const [subjectId, courseId] of picks) {
    if (
      !chosen.has(subjectId) &&
      candidates.get(subjectId)?.includes(courseId) &&
      !isRuledOut(courseId)
    ) {
      choose(subjectId, courseId, 'picked');
    }
  }

  let settledMore = true;
  while (settledMore) {
    settledMore = false;
    for (const [subjectId, courseIds] of candidates) {
      if (chosen.has(subjectId)) continue;
      const [only, ...others] = courseIds.filter((id) => !isRuledOut(id));
      if (only !== undefined && others.length === 0) {
        choose(subjectId, only, 'implied');
        settledMore = true;
      }
    }
  }

  for (const courseIds of candidates.values()) {
    for (const courseId of courseIds) {
      if (!states.has(courseId)) {
        states.set(courseId, isRuledOut(courseId) ? 'excluded' : 'open');
      }
    }
  }

  return { chosen, states };
}

export interface CourseResolver {
  subjectOf: ReadonlyMap<string, string>;
  resolve: (picks: CoursePicks) => CourseResolution;
  /**
   * True when the member can pick or drop the course. Settled courses follow
   * from other choices, and one the levels alone rule out can never fit.
   */
  isPickable: (resolution: CourseResolution, courseId: string) => boolean;
  /**
   * Drops a picked course, or picks another one in place of every pick it
   * clashes with, so a member can change their mind without undoing first.
   */
  togglePick: (
    resolution: CourseResolution,
    picks: CoursePicks,
    courseId: string,
  ) => CoursePicks;
}

export function createCourseResolver(
  candidates: CourseCandidates,
  lessons: readonly CourseLesson[],
): CourseResolver {
  const graph = buildCourseGraph(candidates, lessons);
  const resolve = (picks: CoursePicks) =>
    resolveCourses(graph, candidates, picks);
  const baseline = resolve(new Map());

  const isPickable = (resolution: CourseResolution, courseId: string) => {
    const state = resolution.states.get(courseId);
    if (state === 'picked') return true;
    return (
      (state === 'open' || state === 'excluded') &&
      baseline.states.get(courseId) === 'open'
    );
  };

  const togglePick = (
    resolution: CourseResolution,
    picks: CoursePicks,
    courseId: string,
  ): CoursePicks => {
    const subjectId = graph.subjectOf.get(courseId);
    if (subjectId === undefined || !isPickable(resolution, courseId)) {
      return picks;
    }

    const next = new Map(picks);
    if (resolution.states.get(courseId) === 'picked') {
      next.delete(subjectId);
      return next;
    }

    for (const [pickedSubjectId, picked] of picks) {
      if (graph.conflicts(picked, courseId)) next.delete(pickedSubjectId);
    }
    next.set(subjectId, courseId);
    return next;
  };

  return { subjectOf: graph.subjectOf, resolve, isPickable, togglePick };
}
