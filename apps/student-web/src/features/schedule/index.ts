import type {
  CourseScheduleOccurrenceDtoType,
  CourseScheduleResponseDtoType,
} from '@course-data/course-contracts';
import { Checkbox } from '@foldkit/ui';
import { Effect, Schema as S } from 'effect';
import { Command } from 'foldkit';
import type { Update } from 'foldkit';
import type { Html, HtmlBuilder } from 'foldkit/html';
import { defineMessageUnion } from 'foldkit/message';
import { defineTaggedUnion } from 'foldkit/schema';
import { defineView } from 'foldkit/submodel';
import { modifyFields } from 'foldkit/struct';

import {
  buttonSecondary,
  compactButtonBase,
  eyebrowClass,
  fieldLabelClass,
  loadingIndicatorClass,
  stateCardBase,
  stateCardFailure,
  stateCardH2Class,
  stateCardPClass,
} from '../../app-styles';
import { CourseScheduleResponseSchema } from '../../course-client';
import { courseClient } from '../../course-client-runtime';
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

const formatDate = (value: string | Date, locale: Localization): string =>
  new Intl.DateTimeFormat(localeTag(locale.locale), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Oslo',
  }).format(value instanceof Date ? value : new Date(value));

const dateKey = (value: string): string => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Oslo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: string): string =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

const formatTime = (value: string, locale: Localization): string =>
  new Intl.DateTimeFormat(localeTag(locale.locale), {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Europe/Oslo',
  }).format(new Date(value));

const roomLabel = (occurrence: CourseScheduleOccurrenceDtoType): string | null => {
  const rooms = occurrence.rooms
    .map((room) => [room.building, room.room].filter((part) => part !== null).join(' '))
    .filter((room) => room.length > 0);
  return rooms.length === 0 ? null : rooms.join(', ');
};

interface DayGroup {
  readonly key: string;
  readonly label: string;
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
    groups.set(key, { key, label: formatDate(day, locale), occurrences: [] });
  }
  for (const occurrence of occurrences) {
    const key = dateKey(occurrence.startsAt);
    const existing = groups.get(key);
    groups.set(
      key,
      existing === undefined
        ? { key, label: formatDate(occurrence.startsAt, locale), occurrences: [occurrence] }
        : { ...existing, occurrences: [...existing.occurrences, occurrence] },
    );
  }
  return [...groups.values()];
};

const sourceFreshness = (
  occurrence: CourseScheduleOccurrenceDtoType,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html =>
  h.details(
    [h.Class('mt-3 rounded-m3-medium bg-surface-container-low px-3 py-2 text-sm')],
    [
      h.summary(
        [h.Class('cursor-pointer font-bold text-primary')],
        [translate(locale, 'schedule.sources')],
      ),
      h.dl(
        [h.Class('grid gap-1 mt-2 mb-0 text-on-surface-variant')],
        [
          h.div(
            [h.Class('grid gap-0.5')],
            [
              h.dt([h.Class('font-semibold')], [translate(locale, 'schedule.sourceProvider')]),
              h.dd([h.Class('m-0')], [occurrence.evidence.provider]),
            ],
          ),
          h.div(
            [h.Class('grid gap-0.5')],
            [
              h.dt([h.Class('font-semibold')], [translate(locale, 'schedule.sourceObserved')]),
              h.dd(
                [h.Class('m-0')],
                [
                  new Intl.DateTimeFormat(localeTag(locale.locale), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                    timeZone: 'Europe/Oslo',
                  }).format(new Date(occurrence.evidence.observedAt)),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );

const eventCard = (
  occurrence: CourseScheduleOccurrenceDtoType,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
  const room = roomLabel(occurrence);
  const title =
    occurrence.title ??
    translate(locale, 'schedule.activityFallback', { code: occurrence.activityCode });
  return h.article(
    [
      h.Class(
        'grid gap-2 rounded-m3-large border border-outline-variant bg-surface-container p-3 shadow-m3-1',
      ),
    ],
    [
      h.div(
        [h.Class('flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1')],
        [
          h.p([h.Class('m-0 text-sm font-extrabold text-primary')], [occurrence.courseCode]),
          h.p(
            [h.Class('m-0 text-sm font-semibold text-on-surface-variant')],
            [
              translate(locale, 'schedule.timeRange', {
                start: formatTime(occurrence.startsAt, locale),
                end: formatTime(occurrence.endsAt, locale),
              }),
            ],
          ),
        ],
      ),
      h.h3([h.Class('m-0 text-base font-extrabold')], [title]),
      occurrence.summary === null
        ? h.empty
        : h.p(
            [h.Class('m-0 text-sm leading-[1.45] text-on-surface-variant')],
            [occurrence.summary],
          ),
      h.dl(
        [h.Class('grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 m-0 text-sm')],
        [
          h.dt(
            [h.Class('font-semibold text-on-surface-variant')],
            [translate(locale, 'schedule.status')],
          ),
          h.dd([h.Class('m-0 font-semibold')], [occurrence.status]),
          ...(room === null
            ? []
            : [
                h.dt(
                  [h.Class('font-semibold text-on-surface-variant')],
                  [translate(locale, 'schedule.room')],
                ),
                h.dd([h.Class('m-0')], [room]),
              ]),
        ],
      ),
      sourceFreshness(occurrence, locale, h),
    ],
  );
};

const sourceStatusCard = (
  item: CourseScheduleResponseDtoType['items'][number],
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html =>
  h.article(
    [
      h.Class(
        item.sourceStatus.status === 'failed'
          ? 'grid gap-1 rounded-m3-large border border-error bg-error-container p-4 text-on-error-container'
          : 'grid gap-1 rounded-m3-large border border-warning bg-warning-container p-4 text-on-warning-container',
      ),
      ...(item.sourceStatus.status === 'failed' ? [h.Role('alert')] : [h.Role('status')]),
    ],
    [
      h.h2(
        [h.Class('m-0 text-base font-extrabold')],
        [
          translate(
            locale,
            item.sourceStatus.status === 'failed'
              ? 'schedule.sourceFailed'
              : 'schedule.sourceUnavailable',
            { code: item.courseCode },
          ),
        ],
      ),
      item.sourceStatus.warning === null
        ? h.empty
        : h.p([h.Class('m-0 text-sm leading-[1.45]')], [item.sourceStatus.warning]),
    ],
  );

const courseChoice = (course: SavedCourse, isSelected: boolean, h: HtmlBuilder<Message>): Html => {
  const id = `schedule-course-${course.courseCode.toLowerCase()}`;
  return Checkbox.view<Message>(
    {
      id,
      isChecked: isSelected,
      onToggle: (checked) =>
        Message.ToggledCourse({ courseCode: course.courseCode, isSelected: checked }),
      toView: (attributes) =>
        h.label(
          [
            ...attributes.label,
            h.Class(
              'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[1.5rem] border border-outline px-3 text-sm font-bold text-on-surface-variant has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary-container has-[[data-checked]]:text-on-primary-container',
            ),
          ],
          [
            h.span(
              [
                ...attributes.checkbox,
                h.AriaLabelledBy(`${id}-label`),
                h.Class(
                  'grid size-[1.15rem] place-items-center rounded-[0.3rem] border-2 border-current text-xs leading-none',
                ),
              ],
              [h.span([h.AriaHidden(true)], [isSelected ? '✓' : ''])],
            ),
            h.span([], [course.courseCode]),
          ],
        ),
    },
    h,
  );
};

const courseSelection = (
  model: Model,
  savedCourses: ReadonlyArray<SavedCourse> | null,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html =>
  h.fieldset(
    [
      h.Class(
        'grid gap-3 rounded-m3-large border border-outline-variant bg-surface-container-low p-4',
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
): Html => {
  const id = `schedule-activity-${courseCode.toLowerCase()}-${encodeURIComponent(stream.activityCode)}`;
  return Checkbox.view<Message>(
    {
      id,
      isChecked: isVisible,
      onToggle: (visible) =>
        Message.ToggledActivityVisibility({
          courseCode,
          activityCode: stream.activityCode,
          isVisible: visible,
        }),
      toView: (attributes) =>
        h.label(
          [
            ...attributes.label,
            h.Class(
              'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[1.5rem] border border-outline px-3 text-sm font-bold text-on-surface-variant has-[[data-checked]]:border-primary has-[[data-checked]]:bg-primary-container has-[[data-checked]]:text-on-primary-container',
            ),
          ],
          [
            h.span(
              [
                ...attributes.checkbox,
                h.AriaLabelledBy(`${id}-label`),
                h.Class(
                  'grid size-[1.15rem] place-items-center rounded-[0.3rem] border-2 border-current text-xs leading-none',
                ),
              ],
              [h.span([h.AriaHidden(true)], [isVisible ? '✓' : ''])],
            ),
            h.span([], [activityStreamLabel(stream, locale)]),
          ],
        ),
    },
    h,
  );
};

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
    [h.Class('grid gap-3')],
    items.map((item) => {
      const id = `schedule-activities-${item.courseCode.toLowerCase()}`;
      return h.fieldset(
        [
          h.Class(
            'grid gap-3 rounded-m3-large border border-outline-variant bg-surface-container-low p-4',
          ),
          h.AriaDescribedBy(`${id}-help`),
        ],
        [
          h.legend(
            [h.Class('px-1 text-base font-extrabold')],
            [translate(locale, 'schedule.activities', { code: item.courseCode })],
          ),
          h.p(
            [h.Id(`${id}-help`), h.Class('m-0 text-sm leading-[1.45] text-on-surface-variant')],
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
        'grid gap-3 rounded-m3-large border border-outline-variant bg-surface-container-low p-4',
      ),
    ],
    [
      h.div(
        [h.Class('grid gap-1')],
        [
          h.label(
            [h.For('schedule-week'), h.Class(fieldLabelClass)],
            [translate(locale, 'schedule.week')],
          ),
          h.p(
            [h.Id('schedule-week-help'), h.Class('m-0 text-sm text-on-surface-variant')],
            [translate(locale, 'schedule.weekHelp', { maximum })],
          ),
        ],
      ),
      h.div(
        [h.Class('flex flex-wrap items-end gap-2')],
        [
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
              'min-h-12 w-24 rounded-m3-medium border border-outline bg-surface-container px-3 text-base font-bold',
            ),
          ]),
          h.button(
            [
              h.Type('button'),
              h.OnClick(Message.RequestedPreviousWeek()),
              h.Disabled(model.week <= 1),
              h.AriaLabel(translate(locale, 'schedule.previousWeek')),
              h.Class(`${compactButtonBase} ${buttonSecondary} min-h-12`),
            ],
            [translate(locale, 'schedule.previousWeek')],
          ),
          h.button(
            [
              h.Type('button'),
              h.OnClick(Message.RequestedNextWeek()),
              h.Disabled(model.week >= maximum),
              h.AriaLabel(translate(locale, 'schedule.nextWeek')),
              h.Class(`${compactButtonBase} ${buttonSecondary} min-h-12`),
            ],
            [translate(locale, 'schedule.nextWeek')],
          ),
        ],
      ),
    ],
  );
};

const agenda = (
  response: CourseScheduleResponseDtoType,
  hiddenActivityKeys: ReadonlyArray<string>,
  term: string,
  week: number,
  locale: Localization,
  h: HtmlBuilder<Message>,
): Html => {
  const unavailable = response.items.filter((item) => item.sourceStatus.status !== 'available');
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
      activitySelection(response, hiddenActivityKeys, locale, h),
      ...unavailable.map((item) => sourceStatusCard(item, locale, h)),
      isKnownEmptyWeek(response)
        ? h.section(
            [h.Class(stateCardBase), h.Role('status')],
            [
              h.h2([h.Class(stateCardH2Class)], [translate(locale, 'schedule.empty')]),
              h.p([h.Class(stateCardPClass)], [translate(locale, 'schedule.emptyHelp')]),
            ],
          )
        : allPublishedActivitiesHidden
          ? h.section(
              [h.Class(stateCardBase), h.Role('status')],
              [
                h.h2([h.Class(stateCardH2Class)], [translate(locale, 'schedule.hiddenActivities')]),
                h.p(
                  [h.Class(stateCardPClass)],
                  [translate(locale, 'schedule.hiddenActivitiesHelp')],
                ),
              ],
            )
          : visibleOccurrences.length === 0
            ? h.empty
            : h.section(
                [h.Class('grid gap-3')],
                [
                  h.h2(
                    [h.Class('m-0 text-lg font-extrabold')],
                    [translate(locale, 'schedule.agenda')],
                  ),
                  h.ol(
                    [
                      h.Class(
                        'grid gap-3 m-0 p-0 list-none [@media(min-width:72rem)]:grid-cols-7 [@media(min-width:72rem)]:items-start',
                      ),
                    ],
                    days.map((day) =>
                      h.li(
                        [
                          h.Key(day.key),
                          h.Class(
                            `${day.occurrences.length === 0 ? 'hidden [@media(min-width:72rem)]:grid' : 'grid'} min-w-0 gap-2 rounded-m3-large bg-surface-container-low p-2 [@media(min-width:72rem)]:min-h-64`,
                          ),
                        ],
                        [
                          h.h3(
                            [h.Class('m-0 px-1 text-sm font-extrabold text-on-surface-variant')],
                            [day.label],
                          ),
                          h.ol(
                            [h.Class('grid gap-2 m-0 p-0 list-none')],
                            day.occurrences.map((occurrence) =>
                              h.li([h.Key(occurrence.id)], [eventCard(occurrence, locale, h)]),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
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
  (model, { locale, term, savedCourses }, h) =>
    h.section(
      [h.Class('grid gap-5')],
      [
        h.header(
          [],
          [
            h.p([h.Class(eyebrowClass)], [translate(locale, 'schedule.eyebrow')]),
            h.h1(
              [h.Class('m-0 text-[clamp(1.6rem,6vw,2.25rem)] tracking-[-0.035em]')],
              [translate(locale, 'schedule.heading')],
            ),
            h.p(
              [h.Class('mt-2 mb-0 max-w-3xl leading-[1.55] text-on-surface-variant')],
              [translate(locale, 'schedule.intro')],
            ),
          ],
        ),
        h.p(
          [
            h.Class(
              'm-0 rounded-m3-medium bg-secondary-container px-4 py-3 text-sm font-semibold text-on-secondary-container',
            ),
          ],
          [translate(locale, 'schedule.limitations')],
        ),
        weekControl(model, term, locale, h),
        courseSelection(model, savedCourses, locale, h),
        savedCourses !== null && savedCourses.length === 0
          ? h.p(
              [h.Class('m-0 text-sm leading-[1.45] text-on-surface-variant')],
              [translate(locale, 'schedule.noSavedCoursesHelp')],
            )
          : model.selectedCodes.length === 0
            ? h.section(
                [h.Class(stateCardBase), h.Role('status')],
                [
                  h.h2(
                    [h.Class(stateCardH2Class)],
                    [translate(locale, 'schedule.selectionRequired')],
                  ),
                  h.p(
                    [h.Class(stateCardPClass)],
                    [translate(locale, 'schedule.selectionRequiredHelp')],
                  ),
                ],
              )
            : ScheduleResult.match<Html>(model.result, {
                ScheduleIdle: () => h.empty,
                ScheduleLoading: () =>
                  h.section(
                    [h.Class(stateCardBase), h.Role('status'), h.AriaLive('polite')],
                    [
                      h.div([h.Class(loadingIndicatorClass), h.AriaHidden(true)], []),
                      h.h2([h.Class(stateCardH2Class)], [translate(locale, 'schedule.loading')]),
                      h.p([h.Class(stateCardPClass)], [translate(locale, 'schedule.loadingHelp')]),
                    ],
                  ),
                ScheduleFailure: ({ error }) =>
                  h.section(
                    [h.Class(stateCardFailure), h.Role('alert')],
                    [
                      h.h2([h.Class(stateCardH2Class)], [translate(locale, 'schedule.loadFailed')]),
                      h.p([h.Class(stateCardPClass)], [error]),
                    ],
                  ),
                ScheduleSuccess: ({ response }) =>
                  agenda(response, model.hiddenActivityKeys, term, model.week, locale, h),
              }),
      ],
    ),
);
