import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { buildSummary } = require('../n8n/code/summary.js');
const config = JSON.parse(readFileSync(new URL('../config/demo-plumbing.json', import.meta.url)));
let n = 0; const test = (t, f) => { f(); n++; console.log('ok  ' + t); };
const base = { call: { call_id: 'c1', from_number: '+15551230000', start_timestamp: Date.parse('2026-10-10T01:30:00Z'), duration_ms: 125000, transcript: 'Agent: hi', call_analysis: { call_summary: 'Caller has a leaking sink.', custom_analysis_data: { caller_name: 'Sam Smith', caller_phone: '5551234567', address: '12 Oak St', problem: 'Leaking sink', outcome: 'booked', appointment_time: 'Monday, October 12 at 8:00 AM', urgent: false } } } };
test('booked summary', () => {
  const r = buildSummary(config, base);
  assert.equal(r.subject, 'Demo Plumbing Co: Booked: Sam Smith - Monday, October 12 at 8:00 AM');
  assert.match(r.body, /Result: Appointment booked for Monday, October 12 at 8:00 AM/);
  assert.match(r.body, /Fri, Oct 9, 8:30 PM \(America\/Chicago\)/); // evening call stays on local date
  assert.match(r.body, /Length: 2m 5s/);
  assert.equal(r.urgent, false);
});
test('urgent flag overrides and warns that nobody was contacted', () => {
  const p = structuredClone(base); p.call.call_analysis.custom_analysis_data.urgent = 'true'; p.call.call_analysis.custom_analysis_data.outcome = 'message';
  const r = buildSummary(config, p);
  assert.match(r.subject, /^\[URGENT\] /); assert.match(r.body, /No technician has been contacted automatically/); assert.equal(r.urgent, true);
});
test('missing analysis still produces a usable email', () => {
  const r = buildSummary(config, { call: { call_id: 'c2', from_number: '+15559998888' } });
  assert.equal(r.subject, 'Demo Plumbing Co: Call from +15559998888');
  assert.match(r.body, /No summary was produced/); assert.doesNotMatch(r.body, /Transcript/);
});
test('empty payload does not crash', () => { assert.ok(buildSummary(config, {}).subject); });
test('long transcript is cut', () => {
  const p = structuredClone(base); p.call.transcript = 'x'.repeat(5000);
  assert.match(buildSummary(config, p).body, /transcript cut/);
});
const mk = (o) => { const p = structuredClone(base); Object.assign(p.call.call_analysis.custom_analysis_data, o); return p; };
test('booked and message calls send', () => {
  assert.equal(buildSummary(config, mk({ outcome: 'booked' })).send, true);
  assert.equal(buildSummary(config, mk({ outcome: 'message' })).send, true);
});
test('urgent always sends, even with no details', () => {
  assert.equal(buildSummary(config, mk({ outcome: 'other', urgent: true, caller_name: '', caller_phone: '' })).send, true);
});
test('a hang-up with nothing collected does not send', () => {
  assert.equal(buildSummary(config, { call: { call_id: 'x', from_number: '+15550000000', call_analysis: { custom_analysis_data: { outcome: 'other' } } } }).send, false);
  assert.equal(buildSummary(config, mk({ outcome: 'other', caller_name: '', caller_phone: '' })).send, false);
});
test('outcome other but the caller left name and number still counts as a lead', () => {
  assert.equal(buildSummary(config, mk({ outcome: 'other' })).send, true);
});
test('business can narrow what it wants (urgent + message only)', () => {
  const c2 = { ...config, notifications: { emailOutcomes: ['message', 'urgent'] } };
  assert.equal(buildSummary(c2, mk({ outcome: 'booked', caller_name: '', caller_phone: '' })).send, false);
});
test('empty payload does not send', () => { assert.equal(buildSummary(config, {}).send, false); });
test('callback outcome is not emailed again by the summary (it has its own email)', () => {
  assert.equal(buildSummary(config, mk({ outcome: 'callback' })).send, false);
  assert.equal(buildSummary(config, mk({ outcome: 'callback', urgent: true })).send, true);
});
test('estimate visits email like bookings, with their own headline', () => {
  const r = buildSummary(config, mk({ outcome: 'estimate', appointment_time: 'Monday at 9 AM' }));
  assert.equal(r.send, true); assert.match(r.subject, /Estimate visit booked: Sam Smith - Monday at 9 AM/); assert.match(r.body, /Free estimate visit booked for Monday at 9 AM/);
});
test('cancelled and rescheduled calls do not get a second email (their workflows already emailed)', () => {
  assert.equal(buildSummary(config, mk({ outcome: 'cancelled' })).send, false);
  assert.equal(buildSummary(config, mk({ outcome: 'rescheduled' })).send, false);
});
test('call log: evening call is After hours on the local date, with outcome and minutes', () => {
  const r = buildSummary(config, base).log;   // 2026-10-10 01:30Z = Fri Oct 9 8:30 PM Chicago
  assert.equal(r.Date, '2026-10-09'); assert.equal(r.Day, 'Fri'); assert.equal(r.Time, '20:30');
  assert.equal(r.Hours, 'After hours'); assert.equal(r.Outcome, 'booked'); assert.equal(r.Minutes, 2.1); assert.equal(r.Phone, '5551234567');
});
test('call log: midday call is Business hours; open/close edges', () => {
  const at = (iso) => { const p = structuredClone(base); p.call.start_timestamp = Date.parse(iso); return buildSummary(config, p).log.Hours; };
  assert.equal(at('2026-10-09T17:00:00Z'), 'Business hours');   // 12:00 Chicago
  assert.equal(at('2026-10-09T13:00:00Z'), 'Business hours');   // 08:00 exactly
  assert.equal(at('2026-10-09T22:00:00Z'), 'After hours');      // 17:00 exactly = closed
  assert.equal(at('2026-10-09T12:59:00Z'), 'After hours');      // 07:59
});
test('call log: every call is logged even when no email is sent; urgent is marked', () => {
  const r = buildSummary(config, { call: { call_id: 'x', from_number: '+15550000000', start_timestamp: Date.parse('2026-10-09T17:00:00Z'), call_analysis: { custom_analysis_data: { outcome: 'other' } } } });
  assert.equal(r.send, false); assert.equal(r.log.Outcome, 'other'); assert.equal(r.log.Name, '');
  assert.equal(buildSummary(config, mk({ urgent: true })).log.Outcome, 'urgent');
  assert.equal(buildSummary(config, {}).log.Hours, 'Unknown');
});
test('info-only calls are logged but not emailed', () => {
  const r = buildSummary(config, mk({ outcome: 'info', caller_name: '', caller_phone: '' }));
  assert.equal(r.send, false); assert.equal(r.log.Outcome, 'info'); assert.match(r.body, /Information only/);
  assert.equal(buildSummary(config, mk({ outcome: 'info' })).send, false);
});
test('other/nothing outcome: no email unless the caller left name and number, logged as-is', () => {
  const r = buildSummary(config, mk({ outcome: 'other/nothing', caller_name: '', caller_phone: '' }));
  assert.equal(r.send, false); assert.equal(r.log.Outcome, 'other/nothing'); assert.match(r.body, /No booking and no details left/);
});
test('businesses without addresses (barbershop) get no Address line and a Request label', () => {
  const shop = { ...config, collectAddress: false };
  const r = buildSummary(shop, base);
  assert.doesNotMatch(r.body, /Address:/); assert.match(r.body, /Request: Leaking sink/);
  assert.match(buildSummary(config, base).body, /Address: 12 Oak St/);
});
console.log(`\n${n} tests passed`);
