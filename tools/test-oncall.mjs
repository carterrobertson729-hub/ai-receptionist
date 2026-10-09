import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
// slots.js + oncall.js share one scope, like the n8n Code node
const src = ['slots.js', 'oncall.js'].map((f) => readFileSync(new URL('../n8n/code/' + f, import.meta.url), 'utf8').replace(/\nif \(typeof module[\s\S]*$/, '\n')).join('\n');
const ctx = vm.createContext({ Intl, Date, String, Math, Object, JSON });
vm.runInContext(src, ctx);
const plain = (v) => JSON.parse(JSON.stringify(v));   // sandbox objects have a different realm
const resolveRecipients = (...a) => plain(ctx.resolveRecipients(...a));
const buildUrgentAlert = (...a) => plain(ctx.buildUrgentAlert(...a));
const base = JSON.parse(readFileSync(new URL('../config/demo-plumbing.json', import.meta.url)));
const cfg = (o = {}) => ({ ...JSON.parse(JSON.stringify(base)), ...o });
let n = 0; const test = (t, f) => { f(); n++; console.log('ok  ' + t); };

const people = { alex: { name: 'Alex', email: 'alex@example.com', phone: '+15550001' } };
const sched = { mon: 'alex', tue: 'alex', wed: 'alex', thu: 'alex', fri: 'alex', sat: 'alex', sun: 'alex' };
test('on-call person plus owner, no duplicates', () => {
  const r = resolveRecipients(cfg({ people, onCallSchedule: sched }), Date.parse('2026-10-08T15:00:00Z'));
  assert.deepEqual(r.map((x) => x.role), ['on-call', 'owner']); assert.equal(r[0].name, 'Alex');
});
test('on-call who is also the owner is sent once', () => {
  const p = { me: { name: 'Carter', email: base.ownerEmail } };
  const r = resolveRecipients(cfg({ people: p, onCallSchedule: { ...sched, thu: 'me' } }), Date.parse('2026-10-08T15:00:00Z'));
  assert.equal(r.length, 1); assert.equal(r[0].role, 'on-call');
});
test('missing schedule falls back to owner only', () => {
  const r = resolveRecipients(cfg({ people: undefined, onCallSchedule: undefined }), Date.now());
  assert.deepEqual(r.map((x) => x.role), ['owner']);
});
test('weekday uses the business time zone, not UTC', () => {
  // Sat 11:30pm Chicago = Sun 04:30Z. Saturday's person must be chosen.
  const c = cfg({ people: { sat: { name: 'SatGuy', email: 's@x.com' }, sun: { name: 'SunGuy', email: 'u@x.com' } }, onCallSchedule: { ...sched, sat: 'sat', sun: 'sun' } });
  assert.equal(resolveRecipients(c, Date.parse('2026-10-11T04:30:00Z'))[0].name, 'SatGuy');
});
test('alert has the details and safety banner', () => {
  const a = buildUrgentAlert(cfg({ people, onCallSchedule: sched }), { name: 'Sam', phone: '5551234567', address: '12 Oak St', problem: 'Pipe burst in basement', safety_issue: true, someone_on_site: 'yes' }, Date.parse('2026-10-08T15:00:00Z'));
  assert.match(a.subject, /^\[URGENT\] Demo Plumbing Co: Pipe burst in basement at 12 Oak St/);
  assert.match(a.body, /SAFETY ISSUE REPORTED/); assert.match(a.body, /Sent to: Alex \(on-call\), Owner \(owner\)/); assert.match(a.body, /Thu, Oct 8, 10:00 AM/);
});
test('no safety flag, no banner; missing fields do not crash; newlines stripped', () => {
  const a = buildUrgentAlert(cfg(), { problem: 'bad\r\nBcc: x@evil.com' }, Date.now());
  assert.doesNotMatch(a.body, /SAFETY ISSUE/); assert.doesNotMatch(a.subject, /[\r\n]/); assert.match(a.body, /Caller: Unknown caller/);
});
console.log(`\n${n} tests passed`);
