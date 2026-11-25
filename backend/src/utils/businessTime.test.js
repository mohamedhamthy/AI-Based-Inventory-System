import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  businessMidnightUtc,
  differenceInBusinessCalendarDays,
  getBusinessDateParts,
} from './businessTime.js';

test('Sri Lanka midnight separates 2026-07-14T18:29:59Z from 2026-07-14T18:30:00Z', () => {
  assert.deepEqual(getBusinessDateParts(new Date('2026-07-14T18:29:59.000Z')), {
    year: 2026,
    month: 7,
    day: 14,
  });
  assert.deepEqual(getBusinessDateParts(new Date('2026-07-14T18:30:00.000Z')), {
    year: 2026,
    month: 7,
    day: 15,
  });
  assert.equal(businessMidnightUtc(2026, 7, 15).toISOString(), '2026-07-14T18:30:00.000Z');
});

test('UTC times between midnight and 05:29 in Sri Lanka remain on the correct business day', () => {
  assert.deepEqual(getBusinessDateParts(new Date('2026-07-14T20:00:00.000Z')), {
    year: 2026,
    month: 7,
    day: 15,
  });
});

test('Sri Lankan month boundary is 2026-07-31T18:30:00Z', () => {
  assert.deepEqual(getBusinessDateParts(new Date('2026-07-31T18:29:59.000Z')), {
    year: 2026,
    month: 7,
    day: 31,
  });
  assert.deepEqual(getBusinessDateParts(new Date('2026-07-31T18:30:00.000Z')), {
    year: 2026,
    month: 8,
    day: 1,
  });
  assert.equal(businessMidnightUtc(2026, 8, 1).toISOString(), '2026-07-31T18:30:00.000Z');
});

test('business-calendar age changes at Colombo midnight, not UTC midnight', () => {
  assert.equal(
    differenceInBusinessCalendarDays(
      new Date('2026-07-14T18:29:59.000Z'),
      new Date('2026-07-14T18:30:00.000Z'),
    ),
    1,
  );
  assert.equal(
    differenceInBusinessCalendarDays(
      new Date('2026-07-14T19:00:00.000Z'),
      new Date('2026-07-14T20:00:00.000Z'),
    ),
    0,
  );
});
