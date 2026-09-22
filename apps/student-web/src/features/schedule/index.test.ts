import { expect, test } from 'vitest';

import { fixtureScheduleResponse } from '../../course-client.fixture';
import {
  Message,
  init,
  isKnownEmptyWeek,
  scheduleMaximumCourses,
  scheduleRequestKey,
  syncFromUrl,
  update,
  weeksInIsoYear,
} from './index';

const commandNames = (commands: ReadonlyArray<{ readonly name: string }>): ReadonlyArray<string> =>
  commands.map((command) => command.name);

test('ISO-week controls do not offer an invalid week 53', () => {
  expect(weeksInIsoYear(2025)).toBe(52);
  expect(weeksInIsoYear(2026)).toBe(53);

  const atFinalWeek = update(init(52, ['TDT4136']), Message.RequestedNextWeek(), '2025-autumn');
  expect(atFinalWeek.model.week).toBe(52);
  expect(atFinalWeek.commands ?? []).toEqual([]);
});

test('schedule responses cannot overwrite a newer week request', () => {
  const newer = update(init(45, ['TDT4136']), Message.ChangedWeek({ value: '46' }), '2026-autumn');
  const stale = update(
    newer.model,
    Message.SucceededSchedule({
      requestKey: scheduleRequestKey('2026-autumn', 45, ['TDT4136']),
      response: fixtureScheduleResponse(['TDT4136'], '2026-autumn', 45),
    }),
    '2026-autumn',
  );

  expect(stale.model).toBe(newer.model);
  expect(stale.commands ?? []).toEqual([]);
});

test('activity visibility is URL-backed local state and never starts another schedule request', () => {
  const hidden = update(
    init(45, ['TDT4136']),
    Message.ToggledActivityVisibility({
      courseCode: 'tdt4136',
      activityCode: 'lecture',
      isVisible: false,
    }),
    '2026-autumn',
  );

  expect(hidden.model.hiddenActivityKeys).toEqual(['TDT4136:lecture']);
  expect(commandNames(hidden.commands ?? [])).toEqual([]);
  expect(hidden.outMessage).toMatchObject({ _tag: 'RequestedScheduleUrlWrite', mode: 'push' });

  const shown = update(
    hidden.model,
    Message.ToggledActivityVisibility({
      courseCode: 'TDT4136',
      activityCode: 'lecture',
      isVisible: true,
    }),
    '2026-autumn',
  );

  expect(shown.model.hiddenActivityKeys).toEqual([]);
  expect(commandNames(shown.commands ?? [])).toEqual([]);
});

test('URL-restored activity visibility reuses a successful schedule response', () => {
  const requested = syncFromUrl(init(45, ['TDT4136']), {
    term: '2026-autumn',
    week: 45,
    selectedCodes: ['TDT4136'],
    hiddenActivityKeys: [],
    availableCodes: ['TDT4136'],
  });
  const loaded = update(
    requested.model,
    Message.SucceededSchedule({
      requestKey: requested.model.activeRequestKey,
      response: fixtureScheduleResponse(['TDT4136'], '2026-autumn', 45),
    }),
    '2026-autumn',
  );
  const restored = syncFromUrl(loaded.model, {
    term: '2026-autumn',
    week: 45,
    selectedCodes: ['TDT4136'],
    hiddenActivityKeys: ['TDT4136:lecture'],
    availableCodes: ['TDT4136'],
  });

  expect(restored.model.hiddenActivityKeys).toEqual(['TDT4136:lecture']);
  expect(restored.model.result).toBe(loaded.model.result);
  expect(commandNames(restored.commands ?? [])).toEqual([]);
});

test('removing a selected course also removes its hidden activity keys', () => {
  const removed = update(
    init(45, ['TDT4136'], ['TDT4136:lecture']),
    Message.ToggledCourse({ courseCode: 'TDT4136', isSelected: false }),
    '2026-autumn',
  );

  expect(removed.model.selectedCodes).toEqual([]);
  expect(removed.model.hiddenActivityKeys).toEqual([]);
  expect(commandNames(removed.commands ?? [])).toEqual([]);
  expect(removed.outMessage).toMatchObject({ _tag: 'RequestedScheduleUrlWrite', mode: 'push' });
});

test('a twelfth selected course produces feedback instead of a thirteenth request', () => {
  const selectedCodes = Array.from(
    { length: scheduleMaximumCourses },
    (_, index) => `TDT${4100 + index}`,
  );
  const rejected = update(
    init(45, selectedCodes),
    Message.ToggledCourse({ courseCode: 'TDT4999', isSelected: true }),
    '2026-autumn',
  );

  expect(rejected.model.selectedCodes).toEqual(selectedCodes);
  expect(rejected.model.selectionLimitReached).toBe(true);
  expect(commandNames(rejected.commands ?? [])).toEqual([]);
});

test('URL selections wait for saved courses, then canonicalize to their intersection', () => {
  const pending = syncFromUrl(init(45), {
    term: '2026-autumn',
    week: 45,
    selectedCodes: ['TDT4136', 'UNKNOWN'],
    hiddenActivityKeys: ['TDT4136:lecture', 'UNKNOWN:exercise', 'TDT4109:seminar'],
    availableCodes: null,
  });
  expect(pending.model.selectedCodes).toEqual(['TDT4136', 'UNKNOWN']);
  expect(pending.commands ?? []).toEqual([]);
  expect(pending.model.hiddenActivityKeys).toEqual(['TDT4136:lecture', 'UNKNOWN:exercise']);

  const ready = syncFromUrl(pending.model, {
    term: '2026-autumn',
    week: 45,
    selectedCodes: ['TDT4136', 'UNKNOWN'],
    hiddenActivityKeys: ['TDT4136:lecture', 'UNKNOWN:exercise', 'TDT4109:seminar'],
    availableCodes: ['TDT4136'],
  });
  expect(ready.model.selectedCodes).toEqual(['TDT4136']);
  expect(ready.model.hiddenActivityKeys).toEqual(['TDT4136:lecture']);

  expect(commandNames(ready.commands ?? [])).toEqual(['FetchSchedule']);
  expect(ready.outMessage).toMatchObject({ _tag: 'RequestedScheduleUrlWrite', mode: 'replace' });
});

test('a successful available source removes stale hidden activities but preserves failed-source keys', () => {
  const pending = syncFromUrl(
    init(
      45,
      ['TDT4136', 'TDT4109'],
      ['TDT4136:lecture', 'TDT4136:obsolete', 'TDT4109:still-hidden'],
    ),
    {
      term: '2026-autumn',
      week: 45,
      selectedCodes: ['TDT4136', 'TDT4109'],
      hiddenActivityKeys: ['TDT4136:lecture', 'TDT4136:obsolete', 'TDT4109:still-hidden'],
      availableCodes: ['TDT4136', 'TDT4109'],
    },
  );
  const response = fixtureScheduleResponse(['TDT4136', 'TDT4109'], '2026-autumn', 45);
  const partialResponse = {
    ...response,
    items: response.items.map((item) =>
      item.courseCode === 'TDT4109'
        ? {
            ...item,
            sourceStatus: {
              ...item.sourceStatus,
              status: 'failed' as const,
              warning: 'Fixture source timed out.',
            },
          }
        : item,
    ),
  };

  const succeeded = update(
    pending.model,
    Message.SucceededSchedule({
      requestKey: pending.model.activeRequestKey,
      response: partialResponse,
    }),
    '2026-autumn',
  );

  expect(succeeded.model.hiddenActivityKeys).toEqual(['TDT4136:lecture', 'TDT4109:still-hidden']);
  expect(commandNames(succeeded.commands ?? [])).toEqual([]);
  expect(succeeded.outMessage).toMatchObject({
    _tag: 'RequestedScheduleUrlWrite',
    mode: 'replace',
  });
});

test('a known empty week stays distinct from a failed course source', () => {
  const empty = fixtureScheduleResponse(['TDT4109'], '2026-autumn', 45);
  const unavailable = {
    ...empty,
    items: empty.items.map((item) => ({
      ...item,
      sourceStatus: {
        ...item.sourceStatus,
        status: 'failed' as const,
        warning: 'Fixture source timed out.',
      },
    })),
  };

  expect(isKnownEmptyWeek(empty)).toBe(true);
  expect(isKnownEmptyWeek(unavailable)).toBe(false);
});
