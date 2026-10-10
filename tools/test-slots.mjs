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

test('30 min step + 60 min spacing: first offer is right at the gap edge, then spread toward the latest start', () => {
  const cfg = { ...config, bookingRules: { ...config.bookingRules, slotStepMinutes: 30, bufferMinutes: 30, offerSpacingMinutes: 60 } };
  const out = S.offerSlots(cfg, booked, { preferred_date: '2026-10-07' }, NOW).map((x) => x.start.slice(11, 16));
  assert.deepEqual(out, ['12:30', '14:00', '15:00']);   // earliest right at the gap edge, then spread to the latest start
});
test('spacing off still spreads the offers across the day (no longer just the earliest three)', () => {
  const cfg = { ...config, bookingRules: { ...config.bookingRules, slotStepMinutes: 30, bufferMinutes: 30 } };
  assert.deepEqual(S.offerSlots(cfg, booked, { preferred_date: '2026-10-07' }, NOW).map((x) => x.start.slice(11, 16)), ['12:30', '14:00', '15:00']);
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

const full = { ...config, hours: { ...config.hours, sat: ['08:00', '17:00'], sun: ['08:00', '17:00'] },
  bookingRules: { ...config.bookingRules, slotStepMinutes: 30, bufferMinutes: 30, offerSpacingMinutes: 60, appointmentMinutes: 120 },
  services: [{ name: 'Water heater replacement', durationMinutes: 60, jobMinutes: 180, pricing: { type: 'big_job' } }, { name: 'Clogged toilet', durationMinutes: 30, pricing: { type: 'flat' } }] };
const SUN = '2026-10-11';
test('asking for Sunday 11:00 on an empty day offers 11:00 first (it used to be cut off after the earliest three)', () => {
  const out = S.offerSlots(full, [], { preferred_date: SUN, preferred_time: '11:00', service: 'Clogged toilet' }, NOW);
  assert.equal(out[0].start.slice(11, 16), '11:00'); assert.ok(out.length >= 2);
  const st = S.requestedTimeStatus(full, [], { preferred_date: SUN, preferred_time: '11:00', service: 'Clogged toilet' }, NOW);
  assert.equal(st.available, true);
});
test('without a requested time the earliest openings are offered, as before', () => {
  assert.equal(S.offerSlots(full, [], { preferred_date: SUN, service: 'Clogged toilet' }, NOW)[0].start.slice(11, 16), '08:00');
});
test('a requested time that is not open says why: booked/gap, closing time, too soon, closed day', () => {
  const ev = [{ start: { dateTime: SUN + 'T11:00:00-04:00' }, end: { dateTime: SUN + 'T12:00:00-04:00' } }];
  const st = (time, e, cfg, extra = {}, now = NOW) => S.requestedTimeStatus(cfg || full, e, { preferred_date: SUN, preferred_time: time, service: 'Clogged toilet', ...extra }, now);
  assert.match(st('11:30', ev).reason, /overlaps another appointment or the travel time/);
  assert.match(st('16:45', []).reason, /outside booking hours|past closing/);
  assert.match(st('09:00', [], full, {}, Date.parse('2026-10-11T12:30:00Z')).reason, /too soon/);
  assert.match(st('10:00', [], { ...full, hours: { ...full.hours, sun: null } }).reason, /no visits that day/);
});
test('big job: default and "estimate" book the short visit, "job" books the whole job', () => {
  assert.equal(S.durationFor(full, 'Water heater replacement'), 60);
  assert.equal(S.durationFor(full, 'Water heater replacement', 'estimate'), 60);
  assert.equal(S.durationFor(full, 'Water heater replacement', 'job'), 180);
  assert.equal(S.durationFor(full, 'Clogged toilet', 'job'), 30);   // visit_type is ignored for ordinary jobs
  const wh = (vt) => S.offerSlots(full, [], { preferred_date: SUN, service: 'Water heater replacement', visit_type: vt }, NOW)[0];
  assert.equal(wh('job').minutes, 180); assert.equal(wh('estimate').minutes, 60);
});
test('booking check honors the visit type (a 3 hour job does not fit a 1 hour gap)', () => {
  const ev = [{ start: { dateTime: SUN + 'T11:00:00-04:00' }, end: { dateTime: SUN + 'T12:00:00-04:00' } }];
  assert.equal(S.isSlotStillOpen(full, ev, SUN + 'T08:00:00-04:00', NOW, 'Water heater replacement', 'estimate'), true);   // ends 9:00
  assert.equal(S.isSlotStillOpen(full, ev, SUN + 'T08:00:00-04:00', NOW, 'Water heater replacement', 'job'), false);       // would end 11:00
});

const multi = { ...full, services: [...full.services, { name: 'Repipe', durationMinutes: 60, jobMinutes: 480, multiDay: true, pricing: { type: 'big_job' } }] };
test('a long job can start any time of day as long as it ends by closing (3h job: 8:00 through 14:00)', () => {
  const day = S.allSlots(full, [], SUN, NOW, 180).map((x) => S.toLocalIso(x.startMs, tz)).filter((x) => x.startsWith(SUN)).map((x) => x.slice(11, 16));
  assert.equal(day[0], '08:00'); assert.equal(day[day.length - 1], '14:00');
});
test('after a 3h job 8-11 the next start is 11:30 (30 minute gap), which is what Carter saw', () => {
  const ev = [{ start: { dateTime: SUN + 'T08:00:00-04:00' }, end: { dateTime: SUN + 'T11:00:00-04:00' } }];
  const day = S.allSlots(full, S.busyFromEvents(ev, tz), SUN, NOW, 180).map((x) => S.toLocalIso(x.startMs, tz)).filter((x) => x.startsWith(SUN)).map((x) => x.slice(11, 16));
  assert.equal(day[0], '11:30');
});
test('multi-day jobs are never booked as the job: "job" quietly becomes an estimate visit', () => {
  assert.equal(S.effectiveVisitType(multi, 'Repipe', 'job'), 'estimate');
  assert.equal(S.durationFor(multi, 'Repipe', 'job'), 60);
  assert.equal(S.effectiveVisitType(multi, 'Water heater replacement', 'job'), 'job');
  assert.equal(S.effectiveVisitType(multi, 'Clogged toilet', 'job'), undefined);
});
test('CALLBACK calendar entries never block technician slots, even if not marked Free', () => {
  const cb = [{ summary: 'CALLBACK: Repipe - Sam', start: { dateTime: SUN + 'T09:00:00-04:00' }, end: { dateTime: SUN + '15:00'.replace('15:00', 'T09:15:00-04:00') } }];
  assert.equal(S.busyFromEvents(cb, tz).length, 0);
  assert.equal(S.offerSlots(full, cb, { preferred_date: SUN, service: 'Clogged toilet' }, NOW)[0].start.slice(11, 16), '08:00');
});
test('callback times: office hours, 15 min, every 30 min, spread, ignore technician jobs', () => {
  const job = [{ summary: 'Leak - Bob', start: { dateTime: SUN + 'T09:00:00-04:00' }, end: { dateTime: SUN + 'T12:00:00-04:00' } }];
  const out = S.offerCallbackSlots(full, job, { preferred_date: SUN, part_of_day: 'morning' }, NOW);
  assert.deepEqual(out.map((x) => x.start.slice(11, 16)), ['08:00', '10:00', '11:00']); assert.equal(out[0].minutes, 15);   // spread across the morning
});
test('callback times skip a slot another caller already took', () => {
  const taken = [{ summary: 'CALLBACK: Repipe - Ann', start: { dateTime: SUN + 'T08:00:00-04:00' }, end: { dateTime: SUN + 'T08:15:00-04:00' } }];
  assert.equal(S.offerCallbackSlots(full, taken, { preferred_date: SUN, part_of_day: 'morning' }, NOW)[0].start.slice(11, 16), '08:30');
});
test('a specific callback time is answered exactly, with a reason when it is not open', () => {
  assert.equal(S.requestedCallbackStatus(full, [], { preferred_date: SUN, preferred_time: '10:30' }, NOW).available, true);
  assert.match(S.requestedCallbackStatus(full, [], { preferred_date: SUN, preferred_time: '19:00' }, NOW).reason, /outside booking hours|past closing/);
});

const hourCfg = { ...full, bookingRules: { ...full.bookingRules, slotStepMinutes: 30, bufferMinutes: 30, offerSpacingMinutes: 60, appointmentMinutes: 60 } };
const pickTimes = (args, ev = []) => S.offerSlots(hourCfg, ev, { preferred_date: SUN, ...args }, NOW).map((x) => x.start.slice(0, 16).replace('2026-10-11T', ''));
test('morning request spreads across the morning and includes 11:00 without being asked', () => {
  assert.deepEqual(pickTimes({ part_of_day: 'morning' }), ['08:00', '10:00', '11:00']);
});
test('afternoon request spreads across the afternoon', () => {
  assert.deepEqual(pickTimes({ part_of_day: 'afternoon' }), ['12:00', '14:00', '16:00']);
});
test('no preference spreads across the whole day', () => {
  assert.deepEqual(pickTimes({}), ['08:00', '12:00', '16:00']);
});
test('offers never repeat a time, even with no minimum spacing', () => {
  const noSpacing = { ...hourCfg, bookingRules: { ...hourCfg.bookingRules, offerSpacingMinutes: 0 } };
  const t = S.offerSlots(noSpacing, [], { preferred_date: SUN, part_of_day: 'morning' }, NOW).map((x) => x.start);
  assert.equal(new Set(t).size, t.length);
  const two = { ...config, bookingRules: { ...config.bookingRules } };   // 2h grid, 2 slots left today: no duplicates either
  const u = S.offerSlots(two, [], {}, NOW).map((x) => x.start); assert.equal(new Set(u).size, u.length);
});
test('a day with few openings fills the rest from the next day', () => {
  const ev = [{ start: { dateTime: SUN + 'T08:00:00-04:00' }, end: { dateTime: SUN + 'T11:00:00-04:00' } }];
  const t = pickTimes({ part_of_day: 'morning' }, ev);
  assert.equal(t[0], '11:30'); assert.equal(t.length, 3);
});

console.log(`\n${passed} tests passed`);
