export type DemoSubject =
  | 'german'
  | 'maths'
  | 'english'
  | 'biology'
  | 'history'
  | 'geography'
  | 'physics'
  | 'chemistry'
  | 'politics'
  | 'art'
  | 'music'
  | 'sport';

export type DemoTask = 'reading' | 'vocab' | 'essay' | 'maths_test' | 'worksheet';

export type LessonChange =
  | { kind: 'canceled' }
  | { kind: 'room'; previousRoom: string }
  | { kind: 'substitute'; previousSubject: DemoSubject };

export interface DemoLesson {
  firstPeriod: number;
  lastPeriod: number;
  subject: DemoSubject;
  room: string;
  change?: LessonChange;
  task?: { key: DemoTask; isExam?: boolean };
}

/** Minutes since midnight. 45-minute lessons, the app's default length. */
export const PERIODS: readonly { start: number; end: number }[] = [
  { start: 480, end: 525 },
  { start: 530, end: 575 },
  { start: 595, end: 640 },
  { start: 645, end: 690 },
  { start: 705, end: 750 },
  { start: 755, end: 800 },
];

/** Breaks shorter than this are just the walk between rooms and stay unlabelled. */
export const MIN_LABELLED_BREAK = 15;

export const DEMO_WEEK: readonly (readonly DemoLesson[])[] = [
  [
    { firstPeriod: 1, lastPeriod: 2, subject: 'maths', room: '204' },
    { firstPeriod: 3, lastPeriod: 3, subject: 'english', room: '112', task: { key: 'vocab' } },
    {
      firstPeriod: 4,
      lastPeriod: 4,
      subject: 'geography',
      room: '112',
      change: { kind: 'substitute', previousSubject: 'history' },
    },
    { firstPeriod: 5, lastPeriod: 6, subject: 'sport', room: 'gym' },
  ],
  [
    { firstPeriod: 1, lastPeriod: 2, subject: 'german', room: '112' },
    { firstPeriod: 3, lastPeriod: 3, subject: 'maths', room: '204', change: { kind: 'canceled' } },
    {
      firstPeriod: 4,
      lastPeriod: 4,
      subject: 'biology',
      room: '021',
      change: { kind: 'room', previousRoom: '115' },
    },
    { firstPeriod: 5, lastPeriod: 5, subject: 'english', room: '112', task: { key: 'reading' } },
    { firstPeriod: 6, lastPeriod: 6, subject: 'art', room: '018' },
  ],
  [
    {
      firstPeriod: 1,
      lastPeriod: 1,
      subject: 'physics',
      room: '301',
      change: { kind: 'room', previousRoom: '303' },
    },
    { firstPeriod: 2, lastPeriod: 2, subject: 'chemistry', room: '302' },
    { firstPeriod: 3, lastPeriod: 4, subject: 'german', room: '112', task: { key: 'essay' } },
    { firstPeriod: 5, lastPeriod: 6, subject: 'music', room: '007' },
  ],
  [
    { firstPeriod: 1, lastPeriod: 2, subject: 'english', room: '112' },
    {
      firstPeriod: 3,
      lastPeriod: 3,
      subject: 'maths',
      room: '204',
      task: { key: 'maths_test', isExam: true },
    },
    {
      firstPeriod: 4,
      lastPeriod: 4,
      subject: 'politics',
      room: '112',
      change: { kind: 'canceled' },
    },
    { firstPeriod: 5, lastPeriod: 6, subject: 'biology', room: '115' },
  ],
  [
    { firstPeriod: 1, lastPeriod: 1, subject: 'history', room: '112' },
    { firstPeriod: 2, lastPeriod: 2, subject: 'maths', room: '204', task: { key: 'worksheet' } },
    {
      firstPeriod: 3,
      lastPeriod: 4,
      subject: 'physics',
      room: '302',
      change: { kind: 'substitute', previousSubject: 'chemistry' },
    },
    { firstPeriod: 5, lastPeriod: 5, subject: 'german', room: '112' },
  ],
];

export const lessonStart = (lesson: DemoLesson) => PERIODS[lesson.firstPeriod - 1]!.start;
export const lessonEnd = (lesson: DemoLesson) => PERIODS[lesson.lastPeriod - 1]!.end;

export const formatClock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
