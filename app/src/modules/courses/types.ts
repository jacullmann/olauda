import type { GroupType } from '@/modules/groups/types';

export type RegularSubjectCategory = 'core' | 'elective' | 'extra';
export type AbiturSubjectCategory = 'mandatory' | 'optional' | 'zk';
export type SubjectCategory = RegularSubjectCategory | AbiturSubjectCategory;

export const SUBJECT_CATEGORIES: Record<GroupType, readonly SubjectCategory[]> =
  {
    regular: ['core', 'elective', 'extra'],
    abitur: ['mandatory', 'optional', 'zk'],
  } as const;

/**
 * GK, LK and ZK describe a single course, not the subject above it: one subject
 * can offer an LK and two GK courses at the same time.
 */
export type CourseType = 'gk' | 'lk' | 'zk';

/** ZK is missing on purpose — it follows from the subject category. */
export const SELECTABLE_COURSE_TYPES: readonly CourseType[] = [
  'gk',
  'lk',
] as const;

export const DEFAULT_COURSE_TYPE: CourseType = 'gk';

/** The category whose courses are all Zusatzkurse. */
export const ZUSATZKURS_CATEGORY: SubjectCategory = 'zk';

/**
 * How a subject's courses are offered to a member:
 * - `none`: everybody attends the subject, there is nothing to pick.
 * - `required`: the member has to pick one of the courses.
 * - `optional`: the member picks one course or none at all.
 */
export type CourseSelection = 'none' | 'required' | 'optional';

const COURSE_SELECTION: Record<SubjectCategory, CourseSelection> = {
  core: 'none',
  elective: 'required',
  extra: 'optional',
  // An Abitur Pflichtfach is course-based, unlike a regular one.
  mandatory: 'required',
  optional: 'optional',
  zk: 'optional',
};

/** Categories of the other group type stay readable after a type switch. */
const CATEGORY_EQUIVALENTS: Record<SubjectCategory, SubjectCategory> = {
  core: 'mandatory',
  elective: 'mandatory',
  extra: 'optional',
  mandatory: 'elective',
  optional: 'extra',
  zk: 'extra',
};

export function isSubjectCategory(value: unknown): value is SubjectCategory {
  return typeof value === 'string' && value in COURSE_SELECTION;
}

export function isCourseType(value: unknown): value is CourseType {
  return value === 'gk' || value === 'lk' || value === 'zk';
}

export function defaultSubjectCategory(groupType: GroupType): SubjectCategory {
  return groupType === 'abitur' ? 'mandatory' : 'core';
}

export function subjectCategoriesFor(
  groupType: GroupType,
): readonly SubjectCategory[] {
  return SUBJECT_CATEGORIES[groupType];
}

export function categoryBelongsTo(
  category: unknown,
  groupType: GroupType,
): boolean {
  return (
    isSubjectCategory(category) &&
    subjectCategoriesFor(groupType).includes(category)
  );
}

/**
 * Maps a stored category onto one the current group type accepts. A group that
 * switched its type keeps its subjects, so their categories can be from the
 * other set until they are saved again.
 */
export function normalizeSubjectCategory(
  category: unknown,
  groupType: GroupType,
): SubjectCategory {
  if (!isSubjectCategory(category)) return defaultSubjectCategory(groupType);
  if (categoryBelongsTo(category, groupType)) return category;

  const equivalent = CATEGORY_EQUIVALENTS[category];
  return categoryBelongsTo(equivalent, groupType)
    ? equivalent
    : defaultSubjectCategory(groupType);
}

/** Only Abitur courses carry a type. */
export function usesCourseTypes(groupType: GroupType): boolean {
  return groupType === 'abitur';
}

/**
 * True when an editor picks the type of a course themselves. A Zusatzkurs
 * subject decides it for all of its courses, and a regular group has no types.
 */
export function courseTypeIsSelectable(
  category: unknown,
  groupType: GroupType,
): boolean {
  return usesCourseTypes(groupType) && category !== ZUSATZKURS_CATEGORY;
}

/**
 * The type a course of this subject ends up with, mirroring what the server
 * stores so a freshly edited course is labelled correctly right away.
 */
export function resolveCourseType(
  category: unknown,
  groupType: GroupType,
  requested: unknown,
): CourseType | null {
  if (!usesCourseTypes(groupType)) return null;
  if (category === ZUSATZKURS_CATEGORY) return 'zk';
  return isCourseType(requested) && requested !== 'zk'
    ? requested
    : DEFAULT_COURSE_TYPE;
}

export function courseSelectionFor(category: unknown): CourseSelection {
  return isSubjectCategory(category) ? COURSE_SELECTION[category] : 'none';
}

/**
 * True when a task or lesson for this subject needs a course to identify who it
 * is meant for. An optional subject with a single course is unambiguous.
 */
export function subjectNeedsCourseChoice(
  category: unknown,
  courseCount: number,
): boolean {
  switch (courseSelectionFor(category)) {
    case 'required':
      return courseCount >= 1;
    case 'optional':
      return courseCount >= 2;
    default:
      return false;
  }
}

/**
 * Dalton is a pseudo-subject: lessons can be scheduled for it, but it has no
 * subject row of its own and is only ever named through this translation key.
 */
export const DALTON_SUBJECT_KEY = 'dalton';

/** Mirrors the server's limits in `common::names`. */
export const SUBJECT_NAME_MAX_LENGTH = 60;
export const COURSE_NAME_MAX_LENGTH = 60;
export const CUSTOM_SUBJECT_MAX_LENGTH = 100;
