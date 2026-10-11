import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src = ['slots.js', 'appointments.js'].map((f) => readFileSync(new URL('../n8n/code/' + f, import.meta.url), 'utf8').replace(/\nif \(typeof module[\s\S]*$/, '\n')).join('\n');
const ctx = vm.createContext({ Intl, Date, String, Math, Object, JSON, isNaN, parseInt });
vm.runInContext(src, ctx);
const plain = (v) => JSON.parse(JSON.stringify(v));
const call = (fn) => (...a) => plain(ctx[fn](...a));
const findAppointments = call('findAppointments'), checkCancel = call('checkCancel'), checkReschedule = call('checkReschedule');
const config = { ...JSON.parse(readFileSync(new URL('../config/demo-plumbing.json', import.meta.url))) };
let n = 0; const test = (t, f) => { f(); n++; console.log('ok  ' + t); };
const NOW = Date.parse('2026-10-12T15:00:00Z');   // Mon 10:00 Chicago
const desc = (name, phone, extra = '') => `Booked by AI receptionist\nCaller: ${name}\nPhone: ${phone}\nAddress: 12 Oak St, Chicago\nProblem: Leaking sink\nJob type: Leak repair\nVisit type: Service visit${extra}`;
const ev = (id, start, end, d, extra = {}) => ({ id, summary: 'Leak repair - Sam Smith', description: d, start: { dateTime: start }, end: { dateTime: end }, ...extra });
const mine = ev('e1', '2026-10-14T10:00:00-05:00', '2026-10-14T11:00:00-05:00', desc('Sam Smith', '+15551234567'));
const other = ev('e2', '2026-10-15T09:00:00-05:00', '2026-10-15T10:00:00-05:00', desc('Pat Jones', '+15559998888'));
const callback = ev('e3', '2026-10-13T09:00:00-05:00', '2026-10-13T09:15:00-05:00', desc('Sam Smith', '+15551234567'), { summary: 'CALLBACK: Repipe - Sam Smith' });
const manual = ev('e4', '2026-10-13T13:00:00-05:00', '2026-10-13T14:00:00-05:00', 'owner added this by hand');
const past = ev('e5', '2026-10-05T10:00:00-05:00', '2026-10-05T11:00:00-05:00', desc('Sam Smith', '+15551234567'));
const all = [mine, other, callback, manual, past];

test('lookup finds only this caller\'s upcoming appointments (not others, callbacks, notes without their details, or past events)', () => {
  const r = findAppointments(config, all, { phone: '(555) 123-4567', name: 'Sam Smith' }, NOW);
  assert.equal(r.length, 1); assert.equal(r[0].eventId, 'e1'); assert.equal(r[0].service, 'Leak repair');
  assert.equal(r[0].when, 'Wednesday, October 14 at 10:00 AM'); assert.equal(r[0].minutes, 60);
});
test('lookup needs the right phone AND a matching name', () => {
  assert.equal(findAppointments(config, all, { phone: '5551234567', name: 'Pat Jones' }, NOW).length, 0);
  assert.equal(findAppointments(config, all, { phone: '5550000000', name: 'Sam Smith' }, NOW).length, 0);
  assert.equal(findAppointments(config, all, { phone: '5551234567', name: '' }, NOW).length, 0);
  assert.equal(findAppointments(config, all, { phone: '5551234567', name: 'sam' }, NOW).length, 1);   // first name alone is enough
});
test('estimate visits are reported as estimate so rescheduling uses the right length', () => {
  const est = ev('e6', '2026-10-16T09:00:00-05:00', '2026-10-16T10:00:00-05:00', desc('Sam Smith', '+15551234567').replace('Service visit', 'On-site estimate visit (big job)').replace('Job type: Leak repair', 'Job type: Water heater replacement'), { summary: 'ESTIMATE VISIT: Water heater replacement - Sam Smith' });
  const r = findAppointments(config, [est], { phone: '5551234567', name: 'Sam' }, NOW)[0];
  assert.equal(r.visitType, 'estimate'); assert.equal(r.service, 'Water heater replacement');
});
test('cancel verifies the caller, then returns the event and a clear office email', () => {
  const r = checkCancel(config, all, { event_id: 'e1', phone: '5551234567', name: 'Sam Smith' }, NOW);
  assert.equal(r.status, 'ok'); assert.equal(r.eventId, 'e1'); assert.equal(r.to, config.ownerEmail);
  assert.match(r.subject, /Appointment CANCELLED - Leak repair - Sam Smith/); assert.match(r.body, /Was scheduled: Wednesday, October 14 at 10:00 AM/);
});
test('cancel refuses someone else\'s appointment, a missing id, and calendar notes that do not mention the caller', () => {
  assert.equal(checkCancel(config, all, { event_id: 'e2', phone: '5551234567', name: 'Sam Smith' }, NOW).status, 'not_verified');
  assert.equal(checkCancel(config, all, { event_id: 'nope', phone: '5551234567', name: 'Sam' }, NOW).status, 'not_found');
  assert.equal(checkCancel(config, all, { event_id: 'e4', phone: '5551234567', name: 'Sam' }, NOW).status, 'not_verified');   // a calendar note with no customer details can never be cancelled
});
test('reschedule moves to an open slot, keeps the same length, and ignores the appointment\'s own time', () => {
  const r = checkReschedule(config, all, { event_id: 'e1', phone: '5551234567', name: 'Sam Smith', new_start: '2026-10-14T10:30:00-05:00' }, NOW);
  assert.equal(r.status, 'ok'); assert.equal(r.newStart, '2026-10-14T10:30:00-05:00'); assert.equal(r.newEnd, '2026-10-14T11:30:00-05:00');
  assert.match(r.newDescription, /Rescheduled by caller from: Wednesday, October 14 at 10:00 AM/); assert.match(r.body, /Was: Wednesday, October 14 at 10:00 AM/);
});
test('reschedule into a taken slot returns alternatives; invalid or foreign requests are refused', () => {
  const t = checkReschedule(config, all, { event_id: 'e1', phone: '5551234567', name: 'Sam', new_start: '2026-10-15T09:00:00-05:00' }, NOW);
  assert.equal(t.status, 'taken'); assert.ok(t.alternatives.length > 0);
  assert.equal(checkReschedule(config, all, { event_id: 'e1', phone: '5551234567', name: 'Sam', new_start: 'tomorrow' }, NOW).status, 'invalid_start');
  assert.equal(checkReschedule(config, all, { event_id: 'e2', phone: '5551234567', name: 'Sam', new_start: '2026-10-16T09:00:00-05:00' }, NOW).status, 'not_verified');
});
test('reschedule outside office hours is refused', () => {
  const r = checkReschedule(config, all, { event_id: 'e1', phone: '5551234567', name: 'Sam', new_start: '2026-10-14T20:00:00-05:00' }, NOW);
  assert.equal(r.status, 'taken');
});
const policy = { freeUntilHoursBefore: 24, feeAmount: 50, estimateVisitsExempt: true, rescheduleCountsAsCancel: false };
const cfgWith = (cancellationPolicy) => ({ ...config, cancellationPolicy });
const soon = ev('s1', '2026-10-12T20:00:00-05:00', '2026-10-12T21:00:00-05:00', desc('Sam Smith', '+15551234567'));   // 10 hours from NOW (10:00 AM now, 8:00 PM visit)
const q = { phone: '5551234567', name: 'Sam' };
test('inside the free window: no fee, nothing to mention', () => {
  const r = findAppointments(cfgWith(policy), [mine], q, NOW)[0];   // ~2 days away
  assert.equal(r.cancellation.policyOnFile, true); assert.equal(r.cancellation.feeApplies, false);
  const c = checkCancel(cfgWith(policy), [mine], { event_id: 'e1', ...q }, NOW);
  assert.doesNotMatch(c.body, /LATE CANCELLATION/); assert.doesNotMatch(c.subject, /LATE/);
});
test('too close to the visit: the lookup says a fee may apply, and the office email flags it without charging', () => {
  const r = findAppointments(cfgWith(policy), [soon], q, NOW)[0];
  assert.equal(r.cancellation.feeApplies, true); assert.equal(r.cancellation.feeAmount, 50); assert.equal(r.cancellation.hoursUntilVisit, 10);
  const c = checkCancel(cfgWith(policy), [soon], { event_id: 's1', ...q }, NOW);
  assert.equal(c.status, 'ok'); assert.match(c.subject, /\(LATE - fee applies\)/);
  assert.match(c.body, /LATE CANCELLATION: cancelled about 10 hours before/); assert.match(c.body, /did not charge anything/);
});
test('free estimate visits are exempt by default, but not if the business says so', () => {
  const est = ev('s2', '2026-10-12T20:00:00-05:00', '2026-10-12T21:00:00-05:00', desc('Sam Smith', '+15551234567').replace('Service visit', 'On-site estimate visit (big job)'), { summary: 'ESTIMATE VISIT: Water heater replacement - Sam Smith' });
  assert.equal(findAppointments(cfgWith(policy), [est], q, NOW)[0].cancellation.feeApplies, false);
  assert.equal(findAppointments(cfgWith({ ...policy, estimateVisitsExempt: false }), [est], q, NOW)[0].cancellation.feeApplies, true);
});
test('no policy on file: never any fee talk, cancel still works', () => {
  const r = findAppointments({ ...config, cancellationPolicy: undefined }, [soon], q, NOW)[0];
  assert.equal(r.cancellation.policyOnFile, false); assert.equal(r.cancellation.feeApplies, false);
  const c = checkCancel({ ...config, cancellationPolicy: undefined }, [soon], { event_id: 's1', ...q }, NOW);
  assert.equal(c.status, 'ok'); assert.doesNotMatch(c.body, /LATE CANCELLATION/);
});
test('a late reschedule only carries a fee if the business treats it like a cancellation', () => {
  const args = { event_id: 's1', ...q, new_start: '2026-10-14T10:00:00-05:00' };
  const off = checkReschedule(cfgWith(policy), [soon], args, NOW);
  assert.equal(off.status, 'ok'); assert.equal(off.changeFeeApplies, false); assert.doesNotMatch(off.body, /LATE CHANGE/);
  const on = checkReschedule(cfgWith({ ...policy, rescheduleCountsAsCancel: true }), [soon], args, NOW);
  assert.equal(on.changeFeeApplies, true); assert.match(on.body, /LATE CHANGE: moved about 10 hours before/);
});
// ---- appointments a person typed into the calendar by hand ----
const hand = (id, title, start, end, extra = {}) => ({ id, summary: title, start: { dateTime: start }, end: { dateTime: end }, ...extra });
const typed = [
  hand('h1', 'Sam Smith 555-123-4567 - sink leak', '2026-10-16T09:00:00-05:00', '2026-10-16T10:30:00-05:00'),
  hand('h2', 'Leak repair - Pat Jones', '2026-10-16T13:00:00-05:00', '2026-10-16T14:00:00-05:00', { description: 'cell (555) 999-8888, gate code 4411', location: '77 Elm St' }),
  hand('h3', 'Sam Smith - toilet', '2026-10-17T09:00:00-05:00', '2026-10-17T10:00:00-05:00'),                       // no phone anywhere
  hand('h4', 'Team lunch', '2026-10-16T12:00:00-05:00', '2026-10-16T13:00:00-05:00', { description: 'call 555-123-4567' }),   // phone but no name
  hand('h5', 'Sam Smith day off', '2026-10-18', '2026-10-19', {}),
];
typed[4] = { id: 'h5', summary: 'Sam Smith 555-123-4567 vacation', start: { date: '2026-10-18' }, end: { date: '2026-10-19' } };
test('staff-typed appointment is found when the title has the name and phone, in any phone format', () => {
  const r = findAppointments(config, typed, { phone: '(555) 123-4567', name: 'Sam Smith' }, NOW);
  assert.deepEqual(r.map((x) => x.eventId), ['h1']);
  assert.equal(r[0].title, 'Sam Smith 555-123-4567 - sink leak'); assert.equal(r[0].minutes, 90);
});
test('the phone can be in the description or location, and the job type is read from the title', () => {
  const r = findAppointments(config, typed, { phone: '555.999.8888', name: 'Pat' }, NOW)[0];
  assert.equal(r.eventId, 'h2'); assert.equal(r.service, 'Leak repair'); assert.equal(r.address, '77 Elm St');
});
test('no phone on the event, or a phone without the name, or an all-day note: not matched, so nothing can be cancelled', () => {
  assert.equal(findAppointments(config, typed, { phone: '5551234567', name: 'Sam Smith' }, NOW).some((x) => x.eventId === 'h3'), false);
  assert.equal(findAppointments(config, typed, { phone: '5551234567', name: 'Sam Smith' }, NOW).some((x) => x.eventId === 'h4'), false);
  assert.equal(findAppointments(config, typed, { phone: '5551234567', name: 'Sam Smith' }, NOW).some((x) => x.eventId === 'h5'), false);
  assert.equal(checkCancel(config, typed, { event_id: 'h3', phone: '5551234567', name: 'Sam Smith' }, NOW).status, 'not_verified');
});
test('a phone number must match fully (not just a few digits)', () => {
  assert.equal(findAppointments(config, typed, { phone: '5551234568', name: 'Sam Smith' }, NOW).length, 0);
  assert.equal(findAppointments(config, typed, { phone: '1234567', name: 'Sam Smith' }, NOW).length, 0);
});
test('cancel works on a staff-typed appointment and the office email uses the caller\'s name', () => {
  const c = checkCancel(config, typed, { event_id: 'h1', phone: '5551234567', name: 'Sam Smith' }, NOW);
  assert.equal(c.status, 'ok'); assert.match(c.subject, /Appointment CANCELLED.* - Sam Smith$/); assert.match(c.body, /Calendar entry: Sam Smith 555-123-4567 - sink leak/);
});
test('reschedule works on a staff-typed appointment, keeps its 90 minute length, and appends a note', () => {
  const r = checkReschedule(config, typed, { event_id: 'h1', phone: '5551234567', name: 'Sam', new_start: '2026-10-19T10:00:00-05:00' }, NOW);
  assert.equal(r.status, 'ok'); assert.equal(r.newEnd, '2026-10-19T11:30:00-05:00'); assert.match(r.newDescription, /Rescheduled by caller from/);
  const taken = checkReschedule(config, typed, { event_id: 'h1', phone: '5551234567', name: 'Sam', new_start: '2026-10-16T13:00:00-05:00' }, NOW);
  assert.equal(taken.status, 'taken'); assert.ok(taken.alternatives.every((a) => a.minutes === 90));
});
test('fees are stated as facts (no "may"), and "only if asked" suppresses the announcement flag', () => {
  const c = checkCancel(cfgWith(policy), [soon], { event_id: 's1', ...q }, NOW);
  assert.match(c.body, /a \$50 fee applies/); assert.doesNotMatch(c.body, /may apply/);
  assert.equal(findAppointments(cfgWith(policy), [soon], q, NOW)[0].cancellation.announce, 'when_applies');
  assert.equal(findAppointments(cfgWith({ ...policy, announce: 'only_if_asked' }), [soon], q, NOW)[0].cancellation.announce, 'only_if_asked');
});
console.log(`\n${n} tests passed`);
