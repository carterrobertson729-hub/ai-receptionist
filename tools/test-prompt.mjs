import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { build, bookingHours, priceList } from './build-prompt.mjs';
const config = JSON.parse(readFileSync(new URL('../config/demo-plumbing.json', import.meta.url)));
let n = 0; const test = (t, f) => { f(); n++; console.log('ok  ' + t); };
test('no unfilled placeholders except Retell\'s own time variable', () => {
  const left = build(config).match(/\{\{[^}]*\}\}/g);
  assert.deepEqual(left, ['{{current_time_America/Chicago}}']);
});
test('flat price jobs state the amount; callback jobs never book', () => {
  const p = priceList(config);
  assert.match(p, /Clogged toilet: flat price of \$50/);
  const cb = priceList({ ...config, services: [{ name: 'Custom install', emergency: false, pricing: { type: 'callback' } }] });
  assert.match(cb, /Custom install: do NOT quote a price and do NOT check availability or book/);
});
test('quote-on-site jobs mention only the service call fee', () => {
  assert.match(priceList(config), /Leak repair: no fixed price\. Say there is a \$65 service call fee/);
  assert.doesNotMatch(priceList(config), /Leak repair:.*\$(?!65)\d/);
});
test('missing pricing defaults to quote on site, and no fee wording when there is no fee', () => {
  const c = { ...config, serviceCallFee: undefined, services: [{ name: 'Test job', emergency: false }] };
  assert.match(priceList(c), /Test job: no fixed price\. Say that the technician gives an exact price/);
});
test('emergency services are not in the routine price list', () => {
  assert.doesNotMatch(priceList(config), /Burst pipe/);
});
test('booking hours read naturally', () => {
  const d = (o) => ({ mon: o, tue: o, wed: o, thu: o, fri: o, sat: null, sun: null });
  assert.equal(bookingHours(d(['08:00', '17:00'])), 'Monday through Friday, 8 AM to 5 PM. The office is closed Saturday and Sunday');
  assert.equal(bookingHours({ ...d(['08:00', '17:00']), sat: ['09:00', '13:30'] }), 'Monday through Friday, 8 AM to 5 PM; Saturday, 9 AM to 1:30 PM. The office is closed Sunday');
  assert.equal(bookingHours(config.hours), 'Every day of the week, 8 AM to 5 PM');
});
test('big jobs: share only the estimate range, offer visit and callback, never force', () => {
  const p = priceList(config);
  assert.match(p, /Water heater replacement: BIG JOB\. Never give an exact price/);
  assert.match(p, /These typically run \$1,800 to \$3,200, and they start around \$1,200/);
  assert.match(p, /Do NOT decide for the caller/); assert.match(p, /Never pick \(A\), \(B\) or \(C\) for the caller/); assert.match(build(config), /request_callback/);
});
test('prompt tells the agent how to use request_callback safely', () => {
  const out = build(config);
  assert.match(out, /call `request_callback`/); assert.match(out, /Never invent a callback time the tool did not offer/);
});
test('big jobs offer book-now (A) vs free estimate (B) vs callback (C) with the right visit_type', () => {
  const p = priceList(config);
  assert.match(p, /\(A\) book the job now.*about 3 hours/); assert.match(p, /visit_type "job"/); assert.match(p, /\(B\) a free on-site estimate visit first/); assert.match(p, /visit_type "estimate"/);
});
test('prompt tells the agent to ask the tool about an exact time instead of guessing', () => {
  const out = build(config);
  assert.match(out, /preferred_time/); assert.match(out, /requestedTime/); assert.doesNotMatch(out, /set `part_of_day` to `any`/);
});
test('multi-day jobs never offer to book the job itself', () => {
  const p = priceList(config);
  const sewer = p.split('\n').find((l) => l.startsWith('- Sewer line'));
  assert.match(sewer, /NEVER book the job itself/); assert.doesNotMatch(sewer, /\(A\)/);
  assert.match(p.split('\n').find((l) => l.startsWith('- Water heater replacement')), /\(A\) book the job now/);
});
test('callback steps offer real callback times from the tool', () => {
  const out = build(config);
  assert.match(out, /purpose` set to "callback"/); assert.match(out, /Never invent a callback time/);
});
test('agent must ask morning or afternoon first and offer all returned times', () => {
  const out = build(config);
  assert.match(out, /ALWAYS ask whether they would prefer a morning or an afternoon visit/); assert.match(out, /offer all of the times it returns/);
});
test('prompt explains check / cancel / reschedule safely', () => {
  const out = build(config);
  assert.match(out, /Existing appointments \(check, cancel, reschedule\)/); assert.match(out, /Never cancel without that confirmation/);
  assert.match(out, /check_appointment/); assert.match(out, /cancel_appointment/); assert.match(out, /reschedule_appointment/);
  assert.match(out, /never share anyone else's details/i);
});
test('cancellation policy text comes from the config; no policy means never invent a fee', () => {
  const out = build(config);
  assert.match(out, /free to cancel until 24 hours before the visit; after that a \$50 late cancellation fee may apply \(free estimate visits are exempt\)/);
  assert.match(out, /You never charge anything/); assert.match(out, /never promise to waive it/);
  const none = build({ ...config, cancellationPolicy: undefined });
  assert.match(none, /No cancellation policy is on file\. Never mention or invent a cancellation fee/);
});
test('prompt allows up to four offered times', () => {
  const out = build(config);
  assert.match(out, /Offer at most four times/); assert.match(out, /\(up to four\)/); assert.doesNotMatch(out, /up to three/);
});
console.log(`\n${n} tests passed`);
