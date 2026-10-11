import {
  DEMO_WEEK,
  MIN_LABELLED_BREAK,
  lessonEnd,
  lessonStart,
  type DemoLesson,
} from '~/utils/demoWeek';

export type DayRow =
  | { kind: 'lesson'; key: string; lesson: DemoLesson; start: number; end: number }
  | { kind: 'break'; key: string; start: number; end: number };

export type LiveRelation = 'today' | 'tomorrow' | 'later';

const SCHOOL_DAYS = DEMO_WEEK.length;
const SSR_DAY = 1;

const buildRows = (lessons: readonly DemoLesson[]): DayRow[] =>
  lessons.flatMap((lesson, index): DayRow[] => {
    const row: DayRow = {
      kind: 'lesson',
      key: `lesson-${lesson.firstPeriod}`,
      lesson,
      start: lessonStart(lesson),
      end: lessonEnd(lesson),
    };
    const next = lessons[index + 1];
    if (!next || lessonStart(next) - row.end < MIN_LABELLED_BREAK) return [row];
    return [
      row,
      { kind: 'break', key: `break-${lesson.lastPeriod}`, start: row.end, end: lessonStart(next) },
    ];
  });

const minutesOf = (date: Date) => date.getHours() * 60 + date.getMinutes();

/** Monday is 0. Weekends and afternoons roll over to the next school day. */
const resolveLiveDay = (now: Date): { day: number; relation: LiveRelation; date: Date } => {
  const weekday = (now.getDay() + 6) % 7;
  const lastLesson = DEMO_WEEK[weekday]?.at(-1);
  if (lastLesson && minutesOf(now) < lessonEnd(lastLesson)) {
    return { day: weekday, relation: 'today', date: now };
  }

  const daysAhead = weekday >= SCHOOL_DAYS - 1 ? 7 - weekday : 1;
  const date = new Date(now);
  date.setDate(now.getDate() + daysAhead);
  return { day: (weekday + daysAhead) % 7, relation: daysAhead === 1 ? 'tomorrow' : 'later', date };
};

/**
 * Drives the sample timetable in the hero from the visitor's own clock. Time is only read
 * after mounting, so the server render and hydration agree on a neutral Tuesday.
 */
export const useLiveDay = () => {
  const now = ref<Date | null>(null);
  const chosenDay = ref<number | null>(null);

  const tick = () => {
    now.value = new Date();
  };

  onMounted(tick);
  useIntervalFn(tick, 15_000);

  const live = computed(() => (now.value ? resolveLiveDay(now.value) : null));
  const day = computed(() => chosenDay.value ?? live.value?.day ?? SSR_DAY);
  const isLiveDay = computed(() => live.value !== null && live.value.day === day.value);
  const rows = computed(() => buildRows(DEMO_WEEK[day.value]!));

  /** Clock position inside today's timetable, or null when the view isn't today. */
  const nowMinutes = computed(() =>
    isLiveDay.value && live.value?.relation === 'today' && now.value ? minutesOf(now.value) : null,
  );

  /** The running lesson, or the next one; cancelled lessons are skipped like free periods. */
  const highlightedKey = computed(() => {
    if (!isLiveDay.value) return null;
    const minutes = nowMinutes.value ?? 0;
    const upcoming = rows.value.find(
      (row) => row.kind === 'lesson' && row.lesson.change?.kind !== 'canceled' && row.end > minutes,
    );
    return upcoming?.key ?? null;
  });

  /** Which row the now line sits in and how far down, from 0 to 1. */
  const nowLine = computed(() => {
    const minutes = nowMinutes.value;
    if (minutes === null) return null;
    const first = rows.value[0]!;
    if (minutes < first.start) return { key: first.key, fraction: 0 };

    for (const [index, row] of rows.value.entries()) {
      if (minutes >= row.start && minutes < row.end) {
        return { key: row.key, fraction: (minutes - row.start) / (row.end - row.start) };
      }
      const next = rows.value[index + 1];
      if (next && minutes >= row.end && minutes < next.start) return { key: row.key, fraction: 1 };
    }
    return null;
  });

  return {
    day,
    chosenDay,
    live,
    isLiveDay,
    rows,
    now,
    nowMinutes,
    nowLine,
    highlightedKey,
  };
};
