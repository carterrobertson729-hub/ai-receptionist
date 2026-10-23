import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { buildWeeklyReport, reportDate } = require('../n8n/code/report.js');
let n = 0; const test = (t, f) => { f(); n++; console.log('ok  ' + t); };
const cfg = { businessName: 'Tonic Barbershop', timeZone: 'America/Chicago', ownerEmail: 'o@x.com', usageAlertEmail: 'seller@x.com', plan: { includedMinutes: 300 } };
// "now" = Monday 2026-10-26 08:00 Chicago -> report covers Mon Oct 19 - Sun Oct 25
const now = Date.parse('2026-10-26T13:00:00Z');
const r = (Date_, Day, Hours, Outcome, Minutes, Problem = '') => ({ Date: Date_, Day, Hours, Outcome, Minutes, Problem });
const rows = [
  r('2026-10-20', 'Tue', 'Business hours', 'booked', 2.5, "Men's Haircut"), r('2026-10-21', 'Wed', 'After hours', 'booked', 3, "Men's Haircut"),
  r('2026-10-21', 'Wed', 'After hours', 'info', 1, ''), r('2026-10-24', 'Sat', 'Business hours', 'message', 2, 'Beard Trim'),
  r('10/25/2026', 'Sun', 'After hours', 'other', 0.5, ''),
  r('2026-10-14', 'Wed', 'Business hours', 'booked', 4, "Men's Haircut"),   // previous week
  r('2026-10-26', 'Mon', 'Business hours', 'booked', 9, 'Fade'),            // after the window: ignored for the week
  r('2026-10-02', 'Fri', 'Business hours', 'booked', 20, ''),               // earlier in the month: counts for month minutes? no, September/Oct: counts
];
test('dates in both sheet formats parse', () => { assert.equal(reportDate('10/5/2026'), '2026-10-05'); assert.equal(reportDate('2026-10-05'), '2026-10-05'); assert.equal(reportDate(''), ''); });
test('week counts: calls, split, bookings', () => {
  const x = buildWeeklyReport(cfg, rows, now);
  assert.equal(x.stats.calls, 5); assert.equal(x.stats.business, 2); assert.equal(x.stats.after, 3); assert.equal(x.stats.booked, 2);
  assert.match(x.body, /5 calls answered/); assert.match(x.body, /2 business hours, 3 after hours|2 during business hours, 3 after hours/);
  assert.match(x.body, /2 appointments booked/); assert.match(x.subject, /Oct 19 - Oct 25/);
});
test('compares to last week', () => { assert.match(buildWeeklyReport(cfg, rows, now).body, /Up 4 from last week \(1\)/); });
test('after hours section counts bookings made after hours', () => {
  const b = buildWeeklyReport(cfg, rows, now).body;
  assert.match(b, /3 calls came in when the shop was closed, and 1 turned into a booking/);
});
test('most requested and busiest day', () => {
  const b = buildWeeklyReport(cfg, rows, now).body;
  assert.match(b, /Men's Haircut \(2\)/); assert.match(b, /Wed \(2 calls\)/);
});
test('minutes: week total and month so far against the plan', () => {
  const b = buildWeeklyReport(cfg, rows, now).body;
  assert.match(b, /9 minutes of calls this week/);          // 2.5+3+1+2+0.5
  assert.match(b, /of 300 included minutes used so far in October/);
});
test('no calls: friendly message that suggests checking forwarding', () => {
  const b = buildWeeklyReport(cfg, [], now);
  assert.match(b.body, /No calls reached/); assert.match(b.body, /forwarding/); assert.equal(b.stats.calls, 0);
});
test('rough value only when averageTicket is set', () => {
  assert.doesNotMatch(buildWeeklyReport(cfg, rows, now).body, /ROUGH VALUE/);
  assert.match(buildWeeklyReport({ ...cfg, averageTicket: 30 }, rows, now).body, /roughly \$60/);
});
test('goes to the owner, with a copy for the seller; report email can be set', () => {
  const x = buildWeeklyReport(cfg, rows, now); assert.equal(x.to, 'o@x.com'); assert.equal(x.copyTo, 'seller@x.com');
  assert.equal(buildWeeklyReport({ ...cfg, reportEmail: 'r@x.com' }, rows, now).to, 'r@x.com');
});
test('blank or junk rows do not crash', () => { assert.ok(buildWeeklyReport(cfg, [{}, null, { Date: 'x' }], now).body); });
console.log(`\n${n} tests passed`);
