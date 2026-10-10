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

test('lookup finds only this caller\'s upcoming appointments (not others, callbacks, hand-typed or past events)', () => {
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
test('cancel refuses someone else\'s appointment, a missing id, and hand-typed events', () => {
  assert.equal(checkCancel(config, all, { event_id: 'e2', phone: '5551234567', name: 'Sam Smith' }, NOW).status, 'not_verified');
  assert.equal(checkCancel(config, all, { event_id: 'nope', phone: '5551234567', name: 'Sam' }, NOW).status, 'not_found');
  assert.equal(checkCancel(config, all, { event_id: 'e4', phone: '5551234567', name: 'Sam' }, NOW).status, 'not_found');
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
console.log(`\n${n} tests passed`);
