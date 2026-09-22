import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import scheduleFixture from './fixtures/tdt4136-schedule-2026-autumn.json';
import scheduleSource from './fixtures/tdt4136-schedule-2026-autumn.source.json';
import { parseNtnuCourseSchedule, type NtnuScheduleCaptureMetadata } from './schedule';

const fixtureUrl = new URL('./fixtures/tdt4136-schedule-2026-autumn.json', import.meta.url);
const capture: NtnuScheduleCaptureMetadata = {
  retrievedAt: scheduleSource.capturedAt,
  contentHash: scheduleSource.contentHash.rawBody,
  requestUrl: scheduleSource.requestUrl,
  courseCode: 'TDT4136',
  courseVersion: '1',
  academicYear: 2026,
  season: 'autumn',
  timezone: 'Europe/Oslo',
  evidenceKind: 'fixture',
};

describe('NTNU course schedule boundary', () => {
  it('retains stable dated occurrences from a live current-period capture', () => {
    const result = parseNtnuCourseSchedule(scheduleFixture, capture);
    expect(result.rejected).toEqual([]);
    expect(result.accepted).toHaveLength(67);
    expect(new Set(result.accepted.map((occurrence) => occurrence.sourceRecordId)).size).toBe(67);
    expect(result.accepted[0]).toMatchObject({
      sourceRecordId:
        'ntnu-course-schedule:194-TDT4136-1-1-2-1_2026_HØST_TDT4136:2026-11-06T13:15:00.000Z',
      courseCode: 'TDT4136',
      courseVersion: '1',
      activityCode: '194_TDT4136_1_HØST_2026_1_2_1',
      startsAt: '2026-11-06T13:15:00.000Z',
      endsAt: '2026-11-06T15:00:00.000Z',
      status: 'active',
      week: 45,
      rooms: [
        {
          id: '194_380_3088',
          building: 'Adolf Øien-bygget',
          room: 'U36',
          url: 'http://use.mazemap.com/?v=1&campuses=ntnu&sharepoitype=identifier&sharepoi=380-3088',
        },
      ],
    });
  });

  it('states what the capture cannot prove instead of inferring schedule semantics', () => {
    const result = parseNtnuCourseSchedule(scheduleFixture, capture);

    expect(result.coverage).toEqual({
      activityIdentity: 'provider-recorded',
      dateTime: 'dated-occurrences',
      timezone: 'capture-declared',
      activityType: 'provider-prose',
      activitySelection: 'unknown',
      exceptions: 'status-only',
      campus: 'unknown',
      location: 'rooms-when-published',
    });
  });

  it('rejects a malformed neighbouring occurrence without erasing valid evidence', () => {
    const malformed = {
      ...scheduleFixture.schedules[1],
      tpId: '',
    };
    const result = parseNtnuCourseSchedule(
      { schedules: [scheduleFixture.schedules[0], malformed] },
      capture,
    );

    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.code).toBe('invalid-response-shape');
  });

  it('does not emit duplicate identities or occurrences from another academic period', () => {
    const duplicate = { ...scheduleFixture.schedules[0] };
    const wrongPeriod = {
      ...scheduleFixture.schedules[1],
      artermin: '2026_VÅR',
    };
    const result = parseNtnuCourseSchedule(
      { schedules: [scheduleFixture.schedules[0], duplicate, wrongPeriod] },
      capture,
    );

    expect(result.accepted).toHaveLength(1);
    expect(result.rejected.map((rejection) => rejection.code)).toEqual([
      'invalid-response-shape',
      'invalid-response-shape',
    ]);
  });

  it('keeps the checked-in fixture byte-identical to its capture hash', () => {
    const fixtureBytes = readFileSync(fixtureUrl);
    const digest = createHash('sha256').update(fixtureBytes).digest('hex');

    expect(digest).toBe(scheduleSource.contentHash.rawBody);
  });
});
