import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const S = require('../n8n/code/slots.js');
const config = { ...JSON.parse(readFileSync(new URL('../config/demo-plumbing.json', import.meta.url))), timeZone: 'America/New_York' };
config.hours = { ...config.hours, sat: null, sun: null };   // tests assume a weekdays-only business
config.bookingRules = { appointmentMinutes: 120, slotStepMinutes: 120, bufferMinutes: 0, minNoticeHours: 2, maxDaysAhead: 14, maxSlotsOffered: 3 };   // pinned so demo tuning doesn't break tests
const tz = 'America/New_York';  // fixtures are written in Eastern time
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok  ' + name); };

// 2026-10-06 is a Tuesday. "Now" = 10:00 local (EDT, UTC-4) = 14:00Z.
const NOW = Date.parse('2026-10-06T14:00:00Z');

test('local to UTC respects EDT', () => {
  assert.equal(new Date(S.localToUtcMs('2026-10-13', '08:00', tz)).toISOString(), '2026-10-13T12:00:00.000Z');
});
test('local to UTC respects EST after fall-back (Nov 1 2026)', () => {
  assert.equal(new Date(S.localToUtcMs('2026-11-02', '08:00', tz)).toISOString(), '2026-11-02T13:00:00.000Z');
});
test('toLocalIso round-trips with offset', () => {
  assert.equal(S.toLocalIso(Date.parse('2026-10-13T12:00:00Z'), tz), '2026-10-13T08:00:00-04:00');
  assert.equal(S.toLocalIso(Date.parse('2026-11-02T13:00:00Z'), tz), '2026-11-02T08:00:00-05:00');
});
test('evening local call is not shifted to the next UTC day', () => {
  assert.equal(S.toLocalIso(Date.parse('2026-10-07T02:30:00Z'), tz).slice(0, 10), '2026-10-06');
});
test('empty calendar: first offer respects 2h notice and hours', () => {
  const out = S.offerSlots(config, [], {}, NOW);
  assert.equal(out.length, 3);
  // 10:00 now + 2h notice = 12:00; 2h steps from 08:00 -> 08,10,12,14,16(ends 18>17 no) => 12:00 first
  assert.equal(out[0].start, '2026-10-06T12:00:00-04:00');
  assert.equal(out[1].start, '2026-10-06T14:00:00-04:00');
  assert.equal(out[2].start, '2026-10-07T08:00:00-04:00');
});
test('weekends are skipped', () => {
  const out = S.offerSlots(config, [], { preferred_date: '2026-10-10' }, NOW); // Saturday
  assert.equal(out[0].start, '2026-10-12T08:00:00-04:00'); // Monday
});
test('busy event blocks overlapping slots only', () => {
  const events = [{ start: { dateTime: '2026-10-07T09:00:00-04:00' }, end: { dateTime: '2026-10-07T11:00:00-04:00' } }];
  const out = S.offerSlots(config, events, { preferred_date: '2026-10-07' }, NOW);
  // 08-10 overlaps, 10-12 overlaps, so first free is 12:00
  assert.equal(out[0].start, '2026-10-07T12:00:00-04:00');
});
test('all-day event blocks the whole local day', () => {
  const events = [{ start: { date: '2026-10-07' }, end: { date: '2026-10-08' } }];
  const out = S.offerSlots(config, events, { preferred_date: '2026-10-07' }, NOW);
  assert.equal(out[0].start, '2026-10-08T08:00:00-04:00');
});
test('cancelled and transparent events are ignored', () => {
  const events = [
    { status: 'cancelled', start: { dateTime: '2026-10-07T08:00:00-04:00' }, end: { dateTime: '2026-10-07T10:00:00-04:00' } },
    { transparency: 'transparent', start: { dateTime: '2026-10-07T08:00:00-04:00' }, end: { dateTime: '2026-10-07T10:00:00-04:00' } }
  ];
  assert.equal(S.offerSlots(config, events, { preferred_date: '2026-10-07' }, NOW)[0].start, '2026-10-07T08:00:00-04:00');
});
test('part_of_day afternoon filters', () => {
  const out = S.offerSlots(config, [], { preferred_date: '2026-10-07', part_of_day: 'afternoon' }, NOW);
  assert.equal(out[0].start, '2026-10-07T12:00:00-04:00');
});
test('label is human friendly', () => {
  assert.equal(S.offerSlots(config, [], { preferred_date: '2026-10-13' }, NOW)[0].label, 'Tuesday, October 13 at 8:00 AM');
});
test('isSlotStillOpen accepts a real slot, rejects off-grid, closed-day, and booked times', () => {
  assert.equal(S.isSlotStillOpen(config, [], '2026-10-13T08:00:00-04:00', NOW), true);
  assert.equal(S.isSlotStillOpen(config, [], '2026-10-13T09:00:00-04:00', NOW), false); // off the 2h grid
  assert.equal(S.isSlotStillOpen(config, [], '2026-10-10T08:00:00-04:00', NOW), false); // Saturday
  assert.equal(S.isSlotStillOpen(config, [], '2026-10-06T10:00:00-04:00', NOW), false); // inside notice window
  assert.equal(S.isSlotStillOpen(config, [], 'not a date', NOW), false);
  const booked = [{ start: { dateTime: '2026-10-13T08:00:00-04:00' }, end: { dateTime: '2026-10-13T10:00:00-04:00' } }];
  assert.equal(S.isSlotStillOpen(config, booked, '2026-10-13T08:00:00-04:00', NOW), false);
});
test('same instant in a different offset still matches', () => {
  assert.equal(S.isSlotStillOpen(config, [], '2026-10-13T12:00:00Z', NOW), true);
});

const gapCfg = { ...config, bookingRules: { ...config.bookingRules, slotStepMinutes: 60, bufferMinutes: 30 } };
const booked = [{ start: { dateTime: '2026-10-07T10:00:00-04:00' }, end: { dateTime: '2026-10-07T12:00:00-04:00' } }];
const starts = (cfg, ev) => S.allSlots(cfg, S.busyFromEvents(ev, tz), '2026-10-07', NOW).filter((x) => S.toLocalIso(x.startMs, tz).startsWith('2026-10-07')).map((x) => S.toLocalIso(x.startMs, tz).slice(11, 16));
test('30 min gap: next start after a 10-12 job is 1 PM, and nothing right before it', () => {
  assert.deepEqual(starts(gapCfg, booked), ['13:00', '14:00', '15:00']);
});
test('30 min gap: job ending exactly at the gap edge is allowed (12:30 would be ok on a 30 min grid)', () => {
  const g = { ...gapCfg, bookingRules: { ...gapCfg.bookingRules, slotStepMinutes: 30 } };
  assert.ok(starts(g, booked).includes('12:30')); assert.ok(!starts(g, booked).includes('12:00'));
});
test('no gap setting still allows back-to-back', () => {
  assert.ok(starts({ ...gapCfg, bookingRules: { ...gapCfg.bookingRules, bufferMinutes: 0 } }, booked).includes('12:00'));
});
test('isSlotStillOpen enforces the gap', () => {
  assert.equal(S.isSlotStillOpen(gapCfg, booked, '2026-10-07T12:00:00-04:00', NOW), false);
  assert.equal(S.isSlotStillOpen(gapCfg, booked, '2026-10-07T13:00:00-04:00', NOW), true);
});

test('30 min step + 60 min spacing: first offer is right at the gap edge, offers are spread', () => {
  const cfg = { ...config, bookingRules: { ...config.bookingRules, slotStepMinutes: 30, bufferMinutes: 30, offerSpacingMinutes: 60 } };
  const out = S.offerSlots(cfg, booked, { preferred_date: '2026-10-07' }, NOW).map((x) => x.start.slice(11, 16));
  assert.deepEqual(out, ['12:30', '13:30', '14:30']);
});
test('spacing off keeps old behaviour', () => {
  const cfg = { ...config, bookingRules: { ...config.bookingRules, slotStepMinutes: 30, bufferMinutes: 30 } };
  assert.deepEqual(S.offerSlots(cfg, booked, { preferred_date: '2026-10-07' }, NOW).map((x) => x.start.slice(11, 16)), ['12:30', '13:00', '13:30']);
});
test('12:00 is rejected, 12:30 accepted when booking', () => {
  const cfg = { ...config, bookingRules: { ...config.bookingRules, slotStepMinutes: 30, bufferMinutes: 30 } };
  assert.equal(S.isSlotStillOpen(cfg, booked, '2026-10-07T12:00:00-04:00', NOW), false);
  assert.equal(S.isSlotStillOpen(cfg, booked, '2026-10-07T12:30:00-04:00', NOW), true);
});

const typed = { ...config, bookingRules: { ...config.bookingRules, slotStepMinutes: 30, bufferMinutes: 30, appointmentMinutes: 120 },
  services: [{ name: 'Clogged toilet', durationMinutes: 30 }, { name: 'Toilet repair or replacement', durationMinutes: 90 }, { name: 'Other or not sure', durationMinutes: 120 }, { name: 'Burst pipe', emergency: true }] };
test('durationFor: exact, partial, unknown, missing', () => {
  assert.equal(S.durationFor(typed, 'Clogged toilet'), 30);
  assert.equal(S.durationFor(typed, 'clogged TOILET'), 30);
  assert.equal(S.durationFor(typed, 'something weird'), 120);
  assert.equal(S.durationFor(typed, ''), 120);
  assert.equal(S.durationFor(typed, 'Burst pipe'), 120);   // no duration listed -> default
});
test('a 30 min job fits in the morning before a 10 AM job; a 2 hour job does not', () => {
  const dayStarts = (mins) => S.allSlots(typed, S.busyFromEvents(booked, tz), '2026-10-07', NOW, mins).map((x) => S.toLocalIso(x.startMs, tz)).filter((x) => x.startsWith('2026-10-07')).map((x) => x.slice(11, 16));
  const short = dayStarts(30);
  assert.ok(short.includes('08:00') && short.includes('08:30') && short.includes('09:00'));   // 9:00-9:30 ends exactly at the gap edge
  assert.ok(!short.includes('09:30'));
  const long = dayStarts(120);
  assert.ok(long.length > 0 && !long.some((x) => x < '12:30'));
});
test('offers carry the visit length and booking checks use the job type', () => {
  const out = S.offerSlots(typed, booked, { preferred_date: '2026-10-07', service: 'Clogged toilet' }, NOW);
  assert.equal(out[0].minutes, 30); assert.equal(out[0].start.slice(11, 16), '08:00');
  assert.equal(S.isSlotStillOpen(typed, booked, '2026-10-07T08:00:00-04:00', NOW, 'Clogged toilet'), true);
  assert.equal(S.isSlotStillOpen(typed, booked, '2026-10-07T08:00:00-04:00', NOW, 'Other or not sure'), false);
});
test('last start of the day respects the job length', () => {
  const day = S.allSlots(typed, [], '2026-10-07', NOW, 30).map((x) => S.toLocalIso(x.startMs, tz)).filter((x) => x.startsWith('2026-10-07')).map((x) => x.slice(11, 16));
  assert.equal(day[day.length - 1], '16:30');   // 4:30-5:00 closes at 5
});

console.log(`\n${passed} tests passed`);
