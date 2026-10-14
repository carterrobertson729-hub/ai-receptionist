import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { usageCheck, monthKey } = require('../n8n/code/usage.js');
let n = 0; const test = (t, f) => { f(); n++; console.log('ok  ' + t); };
const cfg = { businessName: 'Demo Plumbing Co', ownerEmail: 'o@x.com', plan: { includedMinutes: 500, warnAtPercent: 80, overagePerMinute: 0.4 } };
const row = (d, m, id) => ({ Date: d, Minutes: m, 'Call ID': id });
test('month keys handle ISO dates and Google-Sheets-style dates', () => {
  assert.equal(monthKey('2026-10-09'), '2026-10'); assert.equal(monthKey('10/9/2026'), '2026-10'); assert.equal(monthKey(''), '');
});
test('under 80%: no alert', () => {
  assert.equal(usageCheck(cfg, [row('2026-10-01', 100, 'a')], row('2026-10-09', 3, 'b')).alert, null);
});
test('the call that crosses 80% sends one warning', () => {
  const r = usageCheck(cfg, [row('2026-10-01', 398, 'a')], row('2026-10-09', 5, 'b'));
  assert.equal(r.alert.level, 'warn'); assert.match(r.alert.subject, /Usage warning.*403 of 500/);
});
test('calls after the warning do not repeat it', () => {
  assert.equal(usageCheck(cfg, [row('2026-10-01', 410, 'a')], row('2026-10-09', 5, 'b')).alert, null);
});
test('the call that crosses 100% sends the limit message, with overage rate', () => {
  const r = usageCheck(cfg, [row('2026-10-01', 497, 'a')], row('2026-10-09', 5, 'b'));
  assert.equal(r.alert.level, 'limit'); assert.match(r.alert.body, /\$0.4 per minute/);
});
test('going straight from under 80% to over 100% sends the limit message only', () => {
  assert.equal(usageCheck(cfg, [row('2026-10-01', 100, 'a')], row('2026-10-09', 450, 'b')).alert.level, 'limit');
});
test('after the limit, no repeat alerts', () => {
  assert.equal(usageCheck(cfg, [row('2026-10-01', 600, 'a')], row('2026-10-09', 5, 'b')).alert, null);
});
test('other months are not counted', () => {
  assert.equal(usageCheck(cfg, [row('2026-09-30', 480, 'a')], row('2026-10-01', 5, 'b')).alert, null);
});
test('this call already in the sheet is not counted twice', () => {
  const r = usageCheck(cfg, [row('2026-10-01', 397, 'a'), row('2026-10-09', 5, 'b')], row('2026-10-09', 5, 'b'));
  assert.equal(r.total, 402); assert.equal(r.alert.level, 'warn');
});
test('no plan on file or junk values: no alert, no crash', () => {
  assert.equal(usageCheck({ businessName: 'x' }, [], row('2026-10-09', 5, 'b')).alert, null);
  assert.equal(usageCheck(cfg, [{ Date: 'junk', Minutes: 'abc' }, {}], row('2026-10-09', 'x', 'b')).alert, null);
  assert.equal(usageCheck(cfg, null, {}).alert, null);
});
console.log(`\n${n} tests passed`);
