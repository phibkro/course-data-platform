import type {
  CourseScheduleOccurrenceDtoType,
  CourseScheduleResponseDtoType,
} from '@course-data/course-contracts';
import { Effect, Schema as S } from 'effect';
import { Command } from 'foldkit';
import type { Update } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import { defineTaggedUnion } from 'foldkit/schema';
import { defineView } from 'foldkit/submodel';
import { modifyFields } from 'foldkit/struct';

import { CourseScheduleResponseSchema } from '../../course-client';
import { courseClient } from '../../course-client-runtime';
import { pageHeader, selectionChip } from '../../components';
import { icon } from '../../icons';
import { localeTag, translate, type Localization } from '../../i18n';
import type { SavedCourse } from '../../saved-courses';

export const scheduleMaximumCourses = 12;

const ScheduleResult = defineTaggedUnion({
  ScheduleIdle: {},
  ScheduleLoading: {},
  ScheduleSuccess: { response: CourseScheduleResponseSchema },
  ScheduleFailure: { error: S.String },
});
export type ScheduleResult = typeof ScheduleResult.Type;
export const ScheduleIdle = ScheduleResult.ScheduleIdle;
export const ScheduleLoading = ScheduleResult.ScheduleLoading;
export const ScheduleSuccess = ScheduleResult.ScheduleSuccess;
export const ScheduleFailure = ScheduleResult.ScheduleFailure;

/**
 * Term deliberately is not schedule state. The root model remains its sole
 * authority and passes it to each transition that needs it.
 */
export const Model = S.Struct({
  week: S.Number,
  selectedCodes: S.Array(S.String),
  hiddenActivityKeys: S.Array(S.String),
  activeRequestKey: S.String,
  result: ScheduleResult,
  selectionLimitReached: S.Boolean,
});
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({
  ChangedWeek: { value: S.String },
  RequestedPreviousWeek: {},
  RequestedNextWeek: {},
  ToggledCourse: { courseCode: S.String, isSelected: S.Boolean },
  ToggledActivityVisibility: {
    courseCode: S.String,
    activityCode: S.String,
    isVisible: S.Boolean,
  },
  SucceededSchedule: { requestKey: S.String, response: CourseScheduleResponseSchema },
  FailedSchedule: { requestKey: S.String, error: S.String },
});
export type Message = typeof Message.Type;

export const OutMessage = defineMessageUnion({
  RequestedScheduleUrlWrite: { mode: S.Literals(['push', 'replace']) },
});
export type OutMessage = typeof OutMessage.Type;

export const ChangedWeek = Message.ChangedWeek;
export const RequestedPreviousWeek = Message.RequestedPreviousWeek;
export const RequestedNextWeek = Message.RequestedNextWeek;
export const ToggledCourse = Message.ToggledCourse;
export const ToggledActivityVisibility = Message.ToggledActivityVisibility;
export const SucceededSchedule = Message.SucceededSchedule;
export const FailedSchedule = Message.FailedSchedule;

const utcDay = 86_400_000;

/** ISO week number for a calendar day already represented as a UTC date. */
export const isoWeekNumber = (date: Date): number => {
  const calendarDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const weekday = calendarDay.getUTCDay() || 7;
  calendarDay.setUTCDate(calendarDay.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(calendarDay.getUTCFullYear(), 0, 1));
  return Math.ceil(((calendarDay.getTime() - yearStart.getTime()) / utcDay + 1) / 7);
};

/** December 28 is always in the final ISO week of its ISO year. */
export const weeksInIsoYear = (year: number): number =>
  isoWeekNumber(new Date(Date.UTC(year, 11, 28)));

export const termYear = (term: string): number => {
  const match = /^(\d{4})-(?:spring|autumn)$/.exec(term);
  return match === null ? 2000 : Number(match[1]);
};

export const weekLimitForTerm = (term: string): number => weeksInIsoYear(termYear(term));

export const clampWeek = (value: number, term: string): number =>
  Math.min(Math.max(Math.trunc(value), 1), weekLimitForTerm(term));

const osloCalendarDate = (instant: Date): Date => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Oslo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const value = (type: string): number => Number(parts.find((part) => part.type === type)?.value);
  return new Date(Date.UTC(value('year'), value('month') - 1, value('day')));
};

/** The current week follows the place where the timetable is published, not the browser clock zone. */
export const currentOsloIsoWeek = (now: Date = new Date()): number =>
  isoWeekNumber(osloCalendarDate(now));

export const normalizedWeek = (
  value: string | number | null,
  term: string,
  fallback: number,
): number => {
  if (value === null || value === '') return clampWeek(fallback, term);
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) ? clampWeek(parsed, term) : clampWeek(fallback, term);
};

/** Returns Monday 00:00 UTC for an ISO week; callers format it in Oslo. */
export const isoWeekStart = (year: number, week: number): Date => {
  const januaryFourth = new Date(Date.UTC(year, 0, 4));
  const weekday = januaryFourth.getUTCDay() || 7;
  januaryFourth.setUTCDate(januaryFourth.getUTCDate() - weekday + 1 + (week - 1) * 7);
  return januaryFourth;
};

const normalizeCode = (code: string): string => code.trim().toUpperCase();

/** URL parsing preserves syntactically invalid values until local saved state is available to reject them. */
export const parseScheduleCodes = (raw: string | null): ReadonlyArray<string> => {
  if (raw === null) return [];
  const seen = new Set<string>();
  const codes: Array<string> = [];
  for (const candidate of raw.split(',')) {
    const code = normalizeCode(candidate);
    if (code.length === 0 || seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
    if (codes.length === scheduleMaximumCourses) break;
  }
  return codes;
};

interface ActivityKeyParts {
  readonly courseCode: string;
  readonly activityCode: string;
}

/** Activity codes may contain colons, so the URL separator is only the first one. */
const activityKeyParts = (value: string): ActivityKeyParts | null => {
  const separator = value.indexOf(':');
  if (separator <= 0) return null;
  const courseCode = normalizeCode(value.slice(0, separator));
  const activityCode = value.slice(separator + 1).trim();
  return courseCode.length === 0 || activityCode.length === 0 ? null : { courseCode, activityCode };
};

const activityVisibilityKey = (courseCode: string, activityCode: string): string | null => {
  const normalizedCourseCode = normalizeCode(courseCode);
  const normalizedActivityCode = activityCode.trim();
  return normalizedCourseCode.length === 0 || normalizedActivityCode.length === 0
    ? null
    : `${normalizedCourseCode}:${normalizedActivityCode}`;
};

const canonicalHiddenActivityKeys = (
  keys: ReadonlyArray<string>,
  selectedCodes: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const selected = new Set(selectedCodes.map(normalizeCode));
  const seen = new Set<string>();
  const canonical: Array<string> = [];
  for (const value of keys) {
    const parts = activityKeyParts(value);
    if (parts === null || !selected.has(parts.courseCode)) continue;
    const key = `${parts.courseCode}:${parts.activityCode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    canonical.push(key);
  }
  return canonical;
};

/** Repeated `hideActivity` parameters are normalized and limited to the selected courses. */
export const parseHiddenActivityKeys = (
  values: ReadonlyArray<string>,
  selectedCodes: ReadonlyArray<string>,
): ReadonlyArray<string> => canonicalHiddenActivityKeys(values, selectedCodes);

const sameCodes = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  left.length === right.length && left.every((code, index) => code === right[index]);

/** Keeps the URL-requested order while allowing only a currently saved course. */
export const selectedSavedCodes = (
  requestedCodes: ReadonlyArray<string>,
  availableCodes: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const available = new Set(availableCodes.map(normalizeCode));
  return requestedCodes.filter((code) => available.has(normalizeCode(code)));
};

export const scheduleRequestKey = (
  term: string,
  week: number,
  selectedCodes: ReadonlyArray<string>,
): string => `${term}|${week}|${selectedCodes.join(',')}`;

export const init = (
  week: number,
  selectedCodes: ReadonlyArray<string> = [],
  hiddenActivityKeys: ReadonlyArray<string> = [],
): Model => ({
  week,
  selectedCodes: [...selectedCodes],
  hiddenActivityKeys: canonicalHiddenActivityKeys(hiddenActivityKeys, selectedCodes),
  activeRequestKey: '',
  result: ScheduleIdle(),
  selectionLimitReached: false,
});

export const FetchSchedule = Command.define('FetchSchedule', {
  args: { courseCodes: S.Array(S.String), term: S.String, week: S.Number, requestKey: S.String },
  messages: [Message.SucceededSchedule, Message.FailedSchedule],
  execute: ({ courseCodes, term, week, requestKey }) =>
    courseClient.getSchedule(courseCodes, term, week).pipe(
      Effect.map((response) => Message.SucceededSchedule({ requestKey, response })),
      Effect.catch((error) =>
        Effect.succeed(Message.FailedSchedule({ requestKey, error: error.message })),
      ),
    ),
});

type UpdateReturn = Update.ReturnWithOutMessage<Model, Message, OutMessage>;

const startRequest = (model: Model, term: string): UpdateReturn => {
  if (model.selectedCodes.length === 0) {
    return {
      model: modifyFields(model, {
        activeRequestKey: () => '',
        result: () => ScheduleIdle(),
      }),
    };
  }

  const requestKey = scheduleRequestKey(term, model.week, model.selectedCodes);
  if (
    requestKey === model.activeRequestKey &&
    (model.result._tag === 'ScheduleLoading' || model.result._tag === 'ScheduleSuccess')
  ) {
    return { model };
  }

  return {
    model: modifyFields(model, {
      activeRequestKey: () => requestKey,
      result: () => ScheduleLoading(),
    }),
    commands: [
      FetchSchedule({
        courseCodes: model.selectedCodes,
        term,
        week: model.week,
        requestKey,
      }),
    ],
  };
};

const withStudentUrlWrite = (next: UpdateReturn): UpdateReturn => ({
  ...next,
  outMessage: OutMessage.RequestedScheduleUrlWrite({ mode: 'push' }),
});

/** Only an available source can disprove a hidden provider-published activity. */
const retainedHiddenActivityKeys = (
  hiddenActivityKeys: ReadonlyArray<string>,
  response: CourseScheduleResponseDtoType,
): ReadonlyArray<string> => {
  const availableStreams = new Map<string, ReadonlySet<string>>();
  for (const item of response.items) {
    if (item.sourceStatus.status !== 'available') continue;
    availableStreams.set(
      normalizeCode(item.courseCode),
      new Set(item.activityStreams.map((stream) => stream.activityCode.trim())),
    );
  }
  return hiddenActivityKeys.filter((key) => {
    const parts = activityKeyParts(key);
    if (parts === null) return false;
    const streams = availableStreams.get(parts.courseCode);
    return streams === undefined || streams.has(parts.activityCode);
  });
};

/** Local interaction transitions; term comes from the root model at the call site. */
export const update = (model: Model, message: Message, term: string): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    ChangedWeek: ({ value }) => {
      if (value.trim().length === 0) return { model };
      const week = normalizedWeek(value, term, model.week);
      if (week === model.week) return { model };
      return withStudentUrlWrite(
        startRequest(
          modifyFields(model, { week: () => week, selectionLimitReached: () => false }),
          term,
        ),
      );
    },
    RequestedPreviousWeek: () => {
      const week = Math.max(1, model.week - 1);
      if (week === model.week) return { model };
      return withStudentUrlWrite(
        startRequest(
          modifyFields(model, { week: () => week, selectionLimitReached: () => false }),
          term,
        ),
      );
    },
    RequestedNextWeek: () => {
      const week = Math.min(weekLimitForTerm(term), model.week + 1);
      if (week === model.week) return { model };
      return withStudentUrlWrite(
        startRequest(
          modifyFields(model, { week: () => week, selectionLimitReached: () => false }),
          term,
        ),
      );
    },
    ToggledCourse: ({ courseCode, isSelected }) => {
      const normalizedCode = normalizeCode(courseCode);
      const selected = model.selectedCodes.includes(normalizedCode);
      if (isSelected === selected) return { model };
      if (isSelected && model.selectedCodes.length >= scheduleMaximumCourses) {
        return { model: modifyFields(model, { selectionLimitReached: () => true }) };
      }
      const selectedCodes = isSelected
        ? [...model.selectedCodes, normalizedCode]
        : model.selectedCodes.filter((code) => code !== normalizedCode);
      return withStudentUrlWrite(
        startRequest(
          modifyFields(model, {
            selectedCodes: () => selectedCodes,
            hiddenActivityKeys: () =>
              isSelected
                ? model.hiddenActivityKeys
                : canonicalHiddenActivityKeys(model.hiddenActivityKeys, selectedCodes),
            selectionLimitReached: () => false,
          }),
          term,
        ),
      );
    },
    ToggledActivityVisibility: ({ courseCode, activityCode, isVisible }) => {
      const key = activityVisibilityKey(courseCode, activityCode);
      if (key === null || !model.selectedCodes.includes(normalizeCode(courseCode))) {
        return { model };
      }
      const isHidden = model.hiddenActivityKeys.includes(key);
      if (isVisible === !isHidden) return { model };
      const hiddenActivityKeys = isVisible
        ? model.hiddenActivityKeys.filter((candidate) => candidate !== key)
        : [...model.hiddenActivityKeys, key];
      return withStudentUrlWrite({
        model: modifyFields(model, {
          hiddenActivityKeys: () => hiddenActivityKeys,
        }),
      });
    },
    SucceededSchedule: ({ requestKey, response }) => {
      if (requestKey !== model.activeRequestKey) return { model };
      const hiddenActivityKeys = retainedHiddenActivityKeys(model.hiddenActivityKeys, response);
      const next = modifyFields(model, {
        hiddenActivityKeys: () => hiddenActivityKeys,
        result: () => ScheduleSuccess({ response }),
      });
      return sameCodes(hiddenActivityKeys, model.hiddenActivityKeys)
        ? { model: next }
        : {
            model: next,
            outMessage: OutMessage.RequestedScheduleUrlWrite({ mode: 'replace' }),
          };
    },
    FailedSchedule: ({ requestKey, error }) =>
      requestKey !== model.activeRequestKey
        ? { model }
        : {
            model: modifyFields(model, { result: () => ScheduleFailure({ error }) }),
          },
  });

export interface RouteState {
  readonly term: string;
  readonly week: number;
  readonly selectedCodes: ReadonlyArray<string>;
  readonly hiddenActivityKeys: ReadonlyArray<string>;
  /** null means saved local state is still unavailable, not that no courses are saved. */
  readonly availableCodes: ReadonlyArray<string> | null;
}

/**
 * Applies an address-bar state. Saved-course canonicalization waits for local
 * state; activity keys outside the requested selection can be dropped now.
 */
export const syncFromUrl = (model: Model, route: RouteState): UpdateReturn => {
  const selectedCodes =
    route.availableCodes === null
      ? route.selectedCodes
      : selectedSavedCodes(route.selectedCodes, route.availableCodes);
  const hiddenActivityKeys = canonicalHiddenActivityKeys(route.hiddenActivityKeys, selectedCodes);
  const requestChanged =
    model.week !== route.week || !sameCodes(model.selectedCodes, selectedCodes);
  const visibilityChanged = !sameCodes(model.hiddenActivityKeys, hiddenActivityKeys);
  const next = requestChanged
    ? modifyFields(model, {
        week: () => route.week,
        selectedCodes: () => selectedCodes,
        hiddenActivityKeys: () => hiddenActivityKeys,
        activeRequestKey: () => '',
        result: () => ScheduleIdle(),
        selectionLimitReached: () => false,
      })
    : visibilityChanged
      ? modifyFields(model, { hiddenActivityKeys: () => hiddenActivityKeys })
      : model;
  const canonicalized =
    !sameCodes(route.selectedCodes, selectedCodes) ||
    !sameCodes(route.hiddenActivityKeys, hiddenActivityKeys);

  if (route.availableCodes === null) {
    return canonicalized
      ? { model: next, outMessage: OutMessage.RequestedScheduleUrlWrite({ mode: 'replace' }) }
      : { model: next };
  }

  const requested = startRequest(next, route.term);
  return canonicalized
    ? { ...requested, outMessage: OutMessage.RequestedScheduleUrlWrite({ mode: 'replace' }) }
    : requested;
};

export const scheduleOccurrences = (
  response: CourseScheduleResponseDtoType,
): ReadonlyArray<CourseScheduleOccurrenceDtoType> =>
  response.items
    .flatMap((item) => item.occurrences)
    .slice()
    .sort((left, right) => {
      const byStart = left.startsAt.localeCompare(right.startsAt);
      if (byStart !== 0) return byStart;
      return left.id.localeCompare(right.id);
    });

export const isKnownEmptyWeek = (response: CourseScheduleResponseDtoType): boolean =>
  response.items.length > 0 &&
  response.items.every(
    (item) => item.sourceStatus.status === 'available' && item.occurrences.length === 0,
  );

const osloDateKeyFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Oslo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const osloTimePartsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Oslo',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const formatDate = (value: string | Date, locale: Localization): string =>
  new Intl.DateTimeFormat(localeTag(locale.locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Oslo',
  }).format(value instanceof Date ? value : new Date(value));

const formatDayLabel = (value: string | Date, locale: Localization): string =>
  new Intl.DateTimeFormat(localeTag(locale.locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Oslo',
  }).format(value instanceof Date ? value : new Date(value));

const formatWeekRange = (term: string, week: number, locale: Localization): string => {
  const formatter = new Intl.DateTimeFormat(localeTag(locale.locale), {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Oslo',
  });
  const start = isoWeekStart(termYear(term), week);
  const end = new Date(start.getTime() + 6 * utcDay);
  return [formatter.format(start), formatter.format(end)].join('–');
};

const datePart = (parts: ReadonlyArray<Intl.DateTimeFormatPart>, type: string): string =>
  parts.find((candidate) => candidate.type === type)?.value ?? '';

const dateKey = (value: string): string => {
  const parts = osloDateKeyFormatter.formatToParts(new Date(value));
  return [datePart(parts, 'year'), datePart(parts, 'month'), datePart(parts, 'day')].join('-');
};

const formatTime = (value: string, locale: Localization): string =>
  new Intl.DateTimeFormat(localeTag(locale.locale), {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Europe/Oslo',
  }).format(new Date(value));

const minutesAtOslo = (value: string): number => {
  const parts = osloTimePartsFormatter.formatToParts(new Date(value));
  const hour = Number.parseInt(datePart(parts, 'hour'), 10);
  const minute = Number.parseInt(datePart(parts, 'minute'), 10);
  return hour * 60 + minute;
};

const roomLabel = (occurrence: CourseScheduleOccurrenceDtoType): string | null => {
  const rooms = occurrence.rooms
    .map((room) => [room.building, room.room].filter((part) => part !== null).join(' '))
    .filter((room) => room.length > 0);
  return rooms.length === 0 ? null : rooms.join(', ');
};

interface DayGroup {
  readonly key: string;
  readonly label: string;
  readonly compactLabel: string;
  readonly occurrences: ReadonlyArray<CourseScheduleOccurrenceDtoType>;
}

const agendaDays = (
  occurrences: ReadonlyArray<CourseScheduleOccurrenceDtoType>,
  term: string,
  week: number,
  locale: Localization,
): ReadonlyArray<DayGroup> => {
  const groups = new Map<string, DayGroup>();
  const weekStart = isoWeekStart(termYear(term), week);
  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(weekStart.getTime() + offset * utcDay);
    const key = day.toISOString().slice(0, 10);
    groups.set(key, {
      key,
      label: formatDate(day, locale),
      compactLabel: formatDayLabel(day, locale),
      occurrences: [],
    });
  }
  for (const occurrence of occurrences) {
    const key = dateKey(occurrence.startsAt);
    const existing = groups.get(key);
    groups.set(
      key,
      existing === undefined
        ? {
            key,
            label: formatDate(occurrence.startsAt, locale),
            compactLabel: formatDayLabel(occurrence.startsAt, locale),
            occurrences: [occurrence],
          }
        : { ...existing, occurrences: [...existing.occurrences, occurrence] },
    );
  }
  return [...groups.values()];
};

const scheduleTones = [
  {
    rail: 'bg-primary',
    event: 'border-primary bg-primary-container text-on-primary-container',
  },
  {
    rail: 'bg-secondary',
    event: 'border-secondary bg-secondary-container text-on-secondary-container',
  },
  {
    rail: 'bg-tertiary',
    event: 'border-tertiary bg-tertiary-container text-on-tertiary-container',
  },
] as const;

type ScheduleTone = (typeof scheduleTones)[number];

const courseTone = (courseCode: string): ScheduleTone => {
  let total = 0;
  for (let index = 0; index < courseCode.length; index += 1) {
    total = (total + courseCode.charCodeAt(index)) % scheduleTones.length;
  }
  return scheduleTones[total]!;
};

const courseChoice = (course: SavedCourse, isSelected: boolean, h: HtmlBuilder<Message>): Html =>
  selectionChip(
    {
      id: ['schedule-course', course.courseCode.toLowerCase()].join('-'),
      label: course.courseCode,
      isSelected,
      onToggle: (checked) =>
        Message.ToggledCourse({ courseCode: course.courseCode, isSelected: checked }),
    },
    h,
  );

const courseSelection = (
  model: Model,
  savedCourses: ReadonlyArray<SavedCourse> | null,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html =>
  h.fieldset(
    [
      h.Class(
        'grid content-start gap-3 rounded-m3-extra-large border border-outline-variant bg-surface-container-low p-[clamp(1rem,2.5vw,1.5rem)] shadow-m3-1',
      ),
      h.AriaDescribedBy('schedule-courses-help'),
    ],
    [
      h.legend([h.Class('px-1 text-base font-extrabold')], [translate(locale, 'schedule.courses')]),
      h.p(
        [
          h.Id('schedule-courses-help'),
          h.Class('m-0 text-sm leading-[1.45] text-on-surface-variant'),
        ],
        [translate(locale, 'schedule.coursesHelp', { maximum: scheduleMaximumCourses })],
      ),
      savedCourses === null
        ? h.p(
            [h.Class('m-0 text-sm font-semibold text-on-surface-variant'), h.Role('status')],
            [translate(locale, 'schedule.savedCoursesLoading')],
          )
        : savedCourses.length === 0
          ? h.p(
              [h.Class('m-0 text-sm leading-[1.45] text-on-surface-variant')],
              [translate(locale, 'schedule.noSavedCourses')],
            )
          : h.div(
              [h.Class('flex flex-wrap gap-2')],
              savedCourses.map((course) =>
                courseChoice(course, model.selectedCodes.includes(course.courseCode), h),
              ),
            ),
      model.selectionLimitReached
        ? h.p(
            [h.Class('m-0 text-sm font-bold text-error'), h.Role('status'), h.AriaLive('polite')],
            [translate(locale, 'schedule.maximumSelected', { maximum: scheduleMaximumCourses })],
          )
        : h.empty,
    ],
  );

const activityStreamLabel = (
  stream: CourseScheduleResponseDtoType['items'][number]['activityStreams'][number],
  locale: Localization,
): string =>
  stream.title ??
  stream.summary ??
  translate(locale, 'schedule.activityFallback', { code: stream.activityCode });

const activityChoice = (
  courseCode: string,
  stream: CourseScheduleResponseDtoType['items'][number]['activityStreams'][number],
  isVisible: boolean,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html =>
  selectionChip(
    {
      id: [
        'schedule-activity',
        courseCode.toLowerCase(),
        encodeURIComponent(stream.activityCode),
      ].join('-'),
      label: activityStreamLabel(stream, locale),
      isSelected: isVisible,
      onToggle: (visible) =>
        Message.ToggledActivityVisibility({
          courseCode,
          activityCode: stream.activityCode,
          isVisible: visible,
        }),
    },
    h,
  );

const activitySelection = (
  response: CourseScheduleResponseDtoType,
  hiddenActivityKeys: ReadonlyArray<string>,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
  const items = response.items.filter((item) => item.activityStreams.length > 0);
  if (items.length === 0) return h.empty;
  const hidden = new Set(hiddenActivityKeys);
  return h.div(
    [h.Class('grid content-start gap-4')],
    items.map((item) => {
      const id = ['schedule-activities', item.courseCode.toLowerCase()].join('-');
      return h.fieldset(
        [
          h.Key(item.courseCode),
          h.Class(
            'grid content-start gap-3 rounded-m3-extra-large border border-outline-variant bg-surface-container-low p-[clamp(1rem,2.5vw,1.5rem)] shadow-m3-1',
          ),
          h.AriaDescribedBy([id, 'help'].join('-')),
        ],
        [
          h.legend(
            [h.Class('px-1 text-base font-extrabold')],
            [translate(locale, 'schedule.activities', { code: item.courseCode })],
          ),
          h.p(
            [
              h.Id([id, 'help'].join('-')),
              h.Class('m-0 text-sm leading-[1.45] text-on-surface-variant'),
            ],
            [translate(locale, 'schedule.activitiesHelp')],
          ),
          h.div(
            [h.Class('flex flex-wrap gap-2')],
            item.activityStreams.map((stream) => {
              const key = activityVisibilityKey(item.courseCode, stream.activityCode);
              return activityChoice(
                item.courseCode,
                stream,
                key === null || !hidden.has(key),
                locale,
                h,
              );
            }),
          ),
        ],
      );
    }),
  );
};

const filterPanels = (
  model: Model,
  savedCourses: ReadonlyArray<SavedCourse> | null,
  response: CourseScheduleResponseDtoType | null,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
  const hasActivityFilters =
    response !== null && response.items.some((item) => item.activityStreams.length > 0);
  return h.div(
    [
      h.Class(
        hasActivityFilters ? 'grid gap-4 [@media(min-width:64rem)]:grid-cols-2' : 'grid gap-4',
      ),
    ],
    [
      courseSelection(model, savedCourses, locale, h),
      hasActivityFilters && response !== null
        ? activitySelection(response, model.hiddenActivityKeys, locale, h)
        : h.empty,
    ],
  );
};

const weekControl = (
  model: Model,
  term: string,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
  const maximum = weekLimitForTerm(term);
  return h.section(
    [
      h.Class(
        'flex flex-wrap items-center gap-2 rounded-m3-extra-large border border-outline-variant bg-surface-container-low p-3 shadow-m3-1',
      ),
    ],
    [
      h.button(
        [
          h.Type('button'),
          h.OnClick(Message.RequestedPreviousWeek()),
          h.Disabled(model.week <= 1),
          h.AriaLabel(translate(locale, 'schedule.previousWeek')),
          h.Class(
            'grid size-11 shrink-0 place-items-center rounded-m3-medium border border-outline-variant bg-surface-container text-lg font-bold text-primary transition-[box-shadow,background-color] hover:bg-surface-container-high focus-visible:outline-3 focus-visible:outline-tertiary focus-visible:outline-offset-3 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60',
          ),
        ],
        [h.span([h.AriaHidden(true)], ['←'])],
      ),
      h.div(
        [
          h.Class(
            'flex min-h-11 items-center rounded-m3-medium border border-outline-variant bg-surface-container px-3',
          ),
        ],
        [
          h.label(
            [h.For('schedule-week'), h.Class('sr-only')],
            [translate(locale, 'schedule.week')],
          ),
          h.span(
            [h.Class('mr-2 text-sm font-semibold text-on-surface-variant')],
            [translate(locale, 'schedule.week')],
          ),
          h.input([
            h.Id('schedule-week'),
            h.Name('week'),
            h.Type('number'),
            h.Min('1'),
            h.Max(String(maximum)),
            h.Value(String(model.week)),
            h.OnInput((value) => Message.ChangedWeek({ value })),
            h.AriaDescribedBy('schedule-week-help'),
            h.Class(
              'w-12 border-0 bg-transparent p-0 text-center text-base font-extrabold tabular-nums outline-none',
            ),
          ]),
        ],
      ),
      h.button(
        [
          h.Type('button'),
          h.OnClick(Message.RequestedNextWeek()),
          h.Disabled(model.week >= maximum),
          h.AriaLabel(translate(locale, 'schedule.nextWeek')),
          h.Class(
            'grid size-11 shrink-0 place-items-center rounded-m3-medium border border-outline-variant bg-surface-container text-lg font-bold text-primary transition-[box-shadow,background-color] hover:bg-surface-container-high focus-visible:outline-3 focus-visible:outline-tertiary focus-visible:outline-offset-3 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60',
          ),
        ],
        [h.span([h.AriaHidden(true)], ['→'])],
      ),
      h.p(
        [
          h.Class(
            'm-0 min-h-11 content-center text-sm font-bold text-on-surface [@media(min-width:32rem)]:ml-auto',
          ),
        ],
        [formatWeekRange(term, model.week, locale)],
      ),
      h.p(
        [h.Id('schedule-week-help'), h.Class('sr-only')],
        [translate(locale, 'schedule.weekHelp', { maximum })],
      ),
    ],
  );
};

const availabilityStatus = (
  response: CourseScheduleResponseDtoType,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
  const failed = response.items.filter((item) => item.sourceStatus.status === 'failed');
  const unavailable = response.items.filter((item) => item.sourceStatus.status === 'unavailable');
  if (failed.length === 0 && unavailable.length === 0) return h.empty;

  const failedCodes = failed.map((item) => item.courseCode).join(', ');
  const unavailableCodes = unavailable.map((item) => item.courseCode).join(', ');
  const warnings = response.items.flatMap((item) =>
    item.sourceStatus.status === 'available' || item.sourceStatus.warning === null
      ? []
      : [[item.courseCode, item.sourceStatus.warning].join(': ')],
  );
  const uniqueWarnings = [...new Set(warnings)];
  const primaryMessage =
    failed.length > 0
      ? translate(locale, 'schedule.sourceFailed', { code: failedCodes })
      : translate(locale, 'schedule.sourceUnavailable', { code: unavailableCodes });

  return h.section(
    [
      h.Class(
        failed.length > 0
          ? 'grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-m3-large border border-error bg-error-container p-4 text-on-error-container'
          : 'grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-m3-large border border-warning bg-warning-container p-4 text-on-warning-container',
      ),
      ...(failed.length > 0 ? [h.Role('alert')] : [h.Role('status')]),
    ],
    [
      h.span(
        [
          h.AriaHidden(true),
          h.Class(
            failed.length > 0
              ? 'grid size-10 place-items-center rounded-m3-medium bg-error text-on-error'
              : 'grid size-10 place-items-center rounded-m3-medium bg-warning text-on-warning',
          ),
        ],
        [icon<Message>('schedule', 'size-5 [&_svg]:block [&_svg]:size-full', h)],
      ),
      h.div(
        [h.Class('grid gap-1')],
        [
          h.h2([h.Class('m-0 text-base font-extrabold')], [primaryMessage]),
          unavailable.length > 0 && failed.length > 0
            ? h.p(
                [h.Class('m-0 text-sm leading-[1.45]')],
                [translate(locale, 'schedule.sourceUnavailable', { code: unavailableCodes })],
              )
            : h.empty,
          uniqueWarnings.length === 0
            ? h.empty
            : h.p([h.Class('m-0 text-sm leading-[1.45]')], [uniqueWarnings.join(' ')]),
        ],
      ),
    ],
  );
};

const eventTitle = (occurrence: CourseScheduleOccurrenceDtoType, locale: Localization): string =>
  occurrence.title ??
  translate(locale, 'schedule.activityFallback', { code: occurrence.activityCode });

const mobileEventCard = (
  occurrence: CourseScheduleOccurrenceDtoType,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
  const room = roomLabel(occurrence);
  const tone = courseTone(occurrence.courseCode);
  const title = eventTitle(occurrence, locale);
  return h.article(
    [
      h.Class(
        'grid grid-cols-[0.5rem_minmax(0,1fr)] overflow-hidden rounded-m3-large border border-outline-variant bg-surface-container-low shadow-m3-1',
      ),
    ],
    [
      h.div([h.AriaHidden(true), h.Class(tone.rail)], []),
      h.div(
        [h.Class('grid gap-3 p-4')],
        [
          h.div(
            [h.Class('grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3')],
            [
              h.p(
                [
                  h.Class(
                    'm-0 border-r border-outline-variant pr-3 text-sm font-extrabold leading-[1.35] tabular-nums text-primary',
                  ),
                ],
                [
                  translate(locale, 'schedule.timeRange', {
                    start: formatTime(occurrence.startsAt, locale),
                    end: formatTime(occurrence.endsAt, locale),
                  }),
                ],
              ),
              h.div(
                [h.Class('grid gap-1')],
                [
                  h.div(
                    [h.Class('flex flex-wrap items-center justify-between gap-x-2 gap-y-1')],
                    [
                      h.p(
                        [h.Class('m-0 text-xs font-extrabold tracking-[0.06em] text-primary')],
                        [occurrence.courseCode],
                      ),
                      h.p(
                        [h.Class('m-0 text-xs font-semibold text-on-surface-variant')],
                        [[translate(locale, 'schedule.status'), occurrence.status].join(': ')],
                      ),
                    ],
                  ),
                  h.h3([h.Class('m-0 text-base font-extrabold leading-[1.2]')], [title]),
                  h.p(
                    [h.Class('m-0 text-sm font-semibold text-on-surface-variant')],
                    [
                      translate(locale, 'schedule.activityFallback', {
                        code: occurrence.activityCode,
                      }),
                    ],
                  ),
                  occurrence.summary === null
                    ? h.empty
                    : h.p(
                        [h.Class('m-0 text-sm leading-[1.45] text-on-surface-variant')],
                        [occurrence.summary],
                      ),
                  room === null
                    ? h.empty
                    : h.p(
                        [h.Class('m-0 text-sm font-medium text-on-surface-variant')],
                        [[translate(locale, 'schedule.room'), room].join(': ')],
                      ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
};

const timetableStartHour = 8;
const timetableEndHour = 18;
const timetableStartMinute = timetableStartHour * 60;
const timetableEndMinute = timetableEndHour * 60;
const timetableDurationMinutes = timetableEndMinute - timetableStartMinute;
const timetableHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] as const;

interface TimetableInterval {
  readonly occurrence: CourseScheduleOccurrenceDtoType;
  readonly startsAt: number;
  readonly endsAt: number;
}

interface TimetablePlacement {
  readonly occurrence: CourseScheduleOccurrenceDtoType;
  readonly topPercent: number;
  readonly heightPercent: number;
  readonly lane: number;
  readonly laneCount: number;
}

const timetablePosition = (minute: number): number =>
  ((minute - timetableStartMinute) / timetableDurationMinutes) * 100;

const timetablePlacements = (
  occurrences: ReadonlyArray<CourseScheduleOccurrenceDtoType>,
): ReadonlyArray<TimetablePlacement> => {
  const intervals: ReadonlyArray<TimetableInterval> = occurrences.map((occurrence) => {
    const startsAt = minutesAtOslo(occurrence.startsAt);
    return {
      occurrence,
      startsAt,
      endsAt: Math.max(startsAt + 1, minutesAtOslo(occurrence.endsAt)),
    };
  });
  const placements: TimetablePlacement[] = [];
  let cursor = 0;

  while (cursor < intervals.length) {
    const cluster: TimetableInterval[] = [];
    let clusterEnd = intervals[cursor]!.endsAt;
    do {
      const interval = intervals[cursor]!;
      cluster.push(interval);
      clusterEnd = Math.max(clusterEnd, interval.endsAt);
      cursor += 1;
    } while (cursor < intervals.length && intervals[cursor]!.startsAt < clusterEnd);

    const laneEnds: number[] = [];
    const clustered = cluster.map((interval) => {
      const availableLane = laneEnds.findIndex((end) => end <= interval.startsAt);
      const lane = availableLane === -1 ? laneEnds.length : availableLane;
      laneEnds[lane] = interval.endsAt;
      return { interval, lane };
    });

    placements.push(
      ...clustered.map(({ interval, lane }) => {
        const clippedStart = Math.min(
          Math.max(interval.startsAt, timetableStartMinute),
          timetableEndMinute - 1,
        );
        const clippedEnd = Math.min(
          timetableEndMinute,
          Math.max(
            Math.min(Math.max(interval.endsAt, timetableStartMinute), timetableEndMinute),
            clippedStart + 1,
          ),
        );
        return {
          occurrence: interval.occurrence,
          topPercent: timetablePosition(clippedStart),
          heightPercent: Math.max(
            timetablePosition(clippedEnd) - timetablePosition(clippedStart),
            0.1,
          ),
          lane,
          laneCount: laneEnds.length,
        };
      }),
    );
  }

  return placements;
};

const desktopEventCard = (
  placement: TimetablePlacement,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
  const { occurrence } = placement;
  const room = roomLabel(occurrence);
  const tone = courseTone(occurrence.courseCode);
  const title = eventTitle(occurrence, locale);
  const laneWidth = 100 / placement.laneCount;
  const laneOffset = placement.lane * laneWidth;
  return h.article(
    [
      h.Key(occurrence.id),
      h.Title([occurrence.courseCode, title].join(' · ')),
      h.Class(
        [
          'absolute min-h-12 overflow-hidden rounded-m3-medium border border-l-[0.4rem] p-2 shadow-m3-1',
          tone.event,
        ].join(' '),
      ),
      h.Style({
        top: String(placement.topPercent) + '%',
        left: 'calc(' + String(laneOffset) + '% + 0.25rem)',
        width: 'calc(' + String(laneWidth) + '% - 0.5rem)',
        height: String(placement.heightPercent) + '%',
      }),
    ],
    [
      h.p(
        [h.Class('m-0 text-[0.6875rem] font-extrabold leading-none tabular-nums')],
        [
          translate(locale, 'schedule.timeRange', {
            start: formatTime(occurrence.startsAt, locale),
            end: formatTime(occurrence.endsAt, locale),
          }),
        ],
      ),
      h.p(
        [h.Class('mt-1 mb-0 text-[0.6875rem] font-extrabold tracking-[0.05em]')],
        [occurrence.courseCode],
      ),
      h.h4([h.Class('m-0 text-xs font-extrabold leading-[1.2]')], [title]),
      h.p(
        [h.Class('m-0 text-[0.6875rem] font-semibold leading-[1.25]')],
        [translate(locale, 'schedule.activityFallback', { code: occurrence.activityCode })],
      ),
      room === null
        ? h.empty
        : h.p(
            [h.Class('m-0 truncate text-[0.6875rem] leading-[1.25]')],
            [[translate(locale, 'schedule.room'), room].join(': ')],
          ),
    ],
  );
};

const timetableHourLabel = (hour: number): string => String(hour).padStart(2, '0') + ':00';

const timetableHourLines = (h: HtmlBuilder<Message>): ReadonlyArray<Html> =>
  timetableHours.map((hour) =>
    h.div(
      [
        h.Key(['timetable-line', String(hour)].join('-')),
        h.AriaHidden(true),
        h.Class('pointer-events-none absolute inset-x-0 border-t border-outline-variant'),
        h.Style({ top: String(timetablePosition(hour * 60)) + '%' }),
      ],
      [],
    ),
  );

const desktopTimetable = (
  days: ReadonlyArray<DayGroup>,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html =>
  h.section(
    [h.Class('hidden gap-3 [@media(min-width:72rem)]:grid')],
    [
      h.h2([h.Class('m-0 text-lg font-extrabold')], [translate(locale, 'schedule.agenda')]),
      h.div(
        [
          h.Class(
            'overflow-x-auto rounded-m3-extra-large border border-outline-variant bg-surface-container-low shadow-m3-1',
          ),
        ],
        [
          h.div(
            [h.Class('min-w-[72rem]')],
            [
              h.div(
                [
                  h.Class(
                    'grid grid-cols-[4.5rem_repeat(7,minmax(9.5rem,1fr))] border-b border-outline-variant',
                  ),
                ],
                [
                  h.div([h.AriaHidden(true), h.Class('border-r border-outline-variant')], []),
                  ...days.map((day) =>
                    h.div(
                      [
                        h.Key(['timetable-heading', day.key].join('-')),
                        h.Class(
                          'min-h-16 border-r border-outline-variant px-3 py-3 last:border-r-0',
                        ),
                      ],
                      [
                        h.h3(
                          [h.Class('m-0 text-sm font-extrabold text-on-surface')],
                          [day.compactLabel],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              h.div(
                [h.Class('grid grid-cols-[4.5rem_repeat(7,minmax(9.5rem,1fr))] overflow-hidden')],
                [
                  h.div(
                    [h.Class('relative h-[40rem] border-r border-outline-variant')],
                    timetableHours.map((hour) =>
                      h.p(
                        [
                          h.Key(['timetable-label', String(hour)].join('-')),
                          h.Class(
                            'absolute left-0 m-0 -translate-y-1/2 pr-2 text-right text-xs font-semibold tabular-nums text-on-surface-variant',
                          ),
                          h.Style({ top: String(timetablePosition(hour * 60)) + '%' }),
                        ],
                        [timetableHourLabel(hour)],
                      ),
                    ),
                  ),
                  ...days.map((day) =>
                    h.div(
                      [
                        h.Key(['timetable-day', day.key].join('-')),
                        h.Class(
                          'relative h-[40rem] border-r border-outline-variant last:border-r-0',
                        ),
                      ],
                      [
                        ...timetableHourLines(h),
                        ...timetablePlacements(day.occurrences).map((placement) =>
                          desktopEventCard(placement, locale, h),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );

const mobileAgenda = (
  days: ReadonlyArray<DayGroup>,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html =>
  h.section(
    [h.Class('grid gap-4 [@media(min-width:72rem)]:hidden')],
    [
      h.h2([h.Class('m-0 text-lg font-extrabold')], [translate(locale, 'schedule.agenda')]),
      h.ol(
        [h.Class('grid gap-5 m-0 list-none p-0')],
        days
          .filter((day) => day.occurrences.length > 0)
          .map((day) =>
            h.li(
              [h.Key(day.key), h.Class('grid gap-2')],
              [
                h.h3(
                  [h.Class('m-0 px-1 text-sm font-extrabold text-on-surface-variant')],
                  [day.label],
                ),
                h.ol(
                  [h.Class('grid gap-2 m-0 list-none p-0')],
                  day.occurrences.map((occurrence) =>
                    h.li([h.Key(occurrence.id)], [mobileEventCard(occurrence, locale, h)]),
                  ),
                ),
              ],
            ),
          ),
      ),
    ],
  );

const agenda = (
  response: CourseScheduleResponseDtoType,
  hiddenActivityKeys: ReadonlyArray<string>,
  term: string,
  week: number,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
  const occurrences = scheduleOccurrences(response);
  const hidden = new Set(hiddenActivityKeys);
  const visibleOccurrences = occurrences.filter((occurrence) => {
    const key = activityVisibilityKey(occurrence.courseCode, occurrence.activityCode);
    return key === null || !hidden.has(key);
  });
  const days =
    visibleOccurrences.length === 0 ? [] : agendaDays(visibleOccurrences, term, week, locale);
  const allPublishedActivitiesHidden = occurrences.length > 0 && visibleOccurrences.length === 0;
  return h.div(
    [h.Class('grid gap-4')],
    [
      availabilityStatus(response, locale, h),
      isKnownEmptyWeek(response)
        ? h.section(
            [
              h.Class(
                'grid min-h-56 place-items-center content-center rounded-m3-extra-large border border-outline-variant bg-surface-container-low p-[clamp(2rem,6vw,4rem)] text-center',
              ),
              h.Role('status'),
            ],
            [
              h.h2(
                [h.Class('m-0 text-[clamp(1.4rem,3vw,2rem)]')],
                [translate(locale, 'schedule.empty')],
              ),
              h.p(
                [h.Class('m-0 max-w-144 text-on-surface-variant leading-[1.6]')],
                [translate(locale, 'schedule.emptyHelp')],
              ),
            ],
          )
        : allPublishedActivitiesHidden
          ? h.section(
              [
                h.Class(
                  'grid min-h-56 place-items-center content-center rounded-m3-extra-large border border-outline-variant bg-surface-container-low p-[clamp(2rem,6vw,4rem)] text-center',
                ),
                h.Role('status'),
              ],
              [
                h.h2(
                  [h.Class('m-0 text-[clamp(1.4rem,3vw,2rem)]')],
                  [translate(locale, 'schedule.hiddenActivities')],
                ),
                h.p(
                  [h.Class('m-0 max-w-144 text-on-surface-variant leading-[1.6]')],
                  [translate(locale, 'schedule.hiddenActivitiesHelp')],
                ),
              ],
            )
          : visibleOccurrences.length === 0
            ? h.empty
            : h.div(
                [h.Class('grid gap-4')],
                [mobileAgenda(days, locale, h), desktopTimetable(days, locale, h)],
              ),
    ],
  );
};

export interface ViewInputs {
  readonly locale: Localization;
  readonly term: string;
  readonly savedCourses: ReadonlyArray<SavedCourse> | null;
}

export const view = defineView<Model, Message, ViewInputs>(
  (model, { locale, term, savedCourses }, h) => {
    const response = model.result._tag === 'ScheduleSuccess' ? model.result.response : null;
    return h.section(
      [h.Class('grid gap-5')],
      [
        pageHeader(
          {
            eyebrow: translate(locale, 'schedule.eyebrow'),
            title: translate(locale, 'schedule.heading'),
            description: translate(locale, 'schedule.intro'),
            showMobileBrand: true,
          },
          h,
        ),
        h.p(
          [
            h.Class(
              'm-0 rounded-m3-large border border-secondary bg-secondary-container px-4 py-3 text-sm font-semibold leading-[1.45] text-on-secondary-container',
            ),
          ],
          [translate(locale, 'schedule.limitations')],
        ),
        weekControl(model, term, locale, h),
        filterPanels(model, savedCourses, response, locale, h),
        savedCourses !== null && savedCourses.length === 0
          ? h.p(
              [h.Class('m-0 text-sm leading-[1.45] text-on-surface-variant')],
              [translate(locale, 'schedule.noSavedCoursesHelp')],
            )
          : model.selectedCodes.length === 0
            ? h.section(
                [
                  h.Class(
                    'grid min-h-56 place-items-center content-center rounded-m3-extra-large border border-outline-variant bg-surface-container-low p-[clamp(2rem,6vw,4rem)] text-center',
                  ),
                  h.Role('status'),
                ],
                [
                  h.h2(
                    [h.Class('m-0 text-[clamp(1.4rem,3vw,2rem)]')],
                    [translate(locale, 'schedule.selectionRequired')],
                  ),
                  h.p(
                    [h.Class('m-0 max-w-144 text-on-surface-variant leading-[1.6]')],
                    [translate(locale, 'schedule.selectionRequiredHelp')],
                  ),
                ],
              )
            : ScheduleResult.match<Html>(model.result, {
                ScheduleIdle: () => h.empty,
                ScheduleLoading: () =>
                  h.section(
                    [
                      h.Class(
                        'grid min-h-56 place-items-center content-center rounded-m3-extra-large border border-outline-variant bg-surface-container-low p-[clamp(2rem,6vw,4rem)] text-center',
                      ),
                      h.Role('status'),
                      h.AriaLive('polite'),
                    ],
                    [
                      h.div(
                        [
                          h.AriaHidden(true),
                          h.Class(
                            'size-12 animate-[spin_850ms_linear_infinite] rounded-full border-[0.3rem] border-primary-container border-t-primary motion-reduce:[animation-duration:1.8s]',
                          ),
                        ],
                        [],
                      ),
                      h.h2(
                        [h.Class('m-0 text-[clamp(1.4rem,3vw,2rem)]')],
                        [translate(locale, 'schedule.loading')],
                      ),
                      h.p(
                        [h.Class('m-0 max-w-144 text-on-surface-variant leading-[1.6]')],
                        [translate(locale, 'schedule.loadingHelp')],
                      ),
                    ],
                  ),
                ScheduleFailure: ({ error }) =>
                  h.section(
                    [
                      h.Class(
                        'grid min-h-56 place-items-center content-center rounded-m3-extra-large border border-error bg-error-container p-[clamp(2rem,6vw,4rem)] text-center text-on-error-container',
                      ),
                      h.Role('alert'),
                    ],
                    [
                      h.h2(
                        [h.Class('m-0 text-[clamp(1.4rem,3vw,2rem)]')],
                        [translate(locale, 'schedule.loadFailed')],
                      ),
                      h.p([h.Class('m-0 max-w-144 leading-[1.6]')], [error]),
                    ],
                  ),
                ScheduleSuccess: ({ response: scheduleResponse }) =>
                  agenda(scheduleResponse, model.hiddenActivityKeys, term, model.week, locale, h),
              }),
      ],
    );
  },
);
