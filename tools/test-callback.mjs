import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
// slots.js + callback.js share one scope, like the n8n Code node
const src = ['slots.js', 'callback.js'].map((f) => readFileSync(new URL('../n8n/code/' + f, import.meta.url), 'utf8').replace(/\nif \(typeof module[\s\S]*$/, '\n')).join('\n');
const ctx = vm.createContext({ Intl, Date, String, Math, Object, JSON });
vm.runInContext(src, ctx);
const plain = (v) => JSON.parse(JSON.stringify(v));
const build = (...a) => plain(ctx.buildCallbackEmail(...a));
const config = JSON.parse(readFileSync(new URL('../config/demo-plumbing.json', import.meta.url)));
let n = 0; const test = (t, f) => { f(); n++; console.log('ok  ' + t); };
const NOW = Date.parse('2026-10-12T15:00:00Z');   // Mon 10:00 Chicago
const base = { name: 'Sam Smith', phone: '5551234567', address: '12 Oak St', service: 'Water heater replacement', problem: 'Old tank leaking, wants a new one', preferred_callback_time: 'tomorrow afternoon', price_discussed: 'Typically $1,800 to $3,200' };

test('email has everything the office needs', () => {
  const e = build(config, base, NOW);
  assert.equal(e.to, config.ownerEmail);
  assert.equal(e.subject, 'Demo Plumbing Co: Callback requested - Water heater replacement - Sam Smith');
  assert.match(e.body, /Best time to call back: tomorrow afternoon/); assert.match(e.body, /Typically \$1,800 to \$3,200/);
  assert.match(e.body, /No appointment has been booked/);
});
test('calendar entry lands at the day and time the caller asked for, 15 minutes, clearly labelled', () => {
  const e = build(config, { ...base, callback_date: '2026-10-13', callback_time: '14:00' }, NOW);
  assert.equal(e.eventStart, '2026-10-13T14:00:00-05:00'); assert.equal(e.eventEnd, '2026-10-13T14:15:00-05:00');
  assert.equal(e.eventTitle, 'CALLBACK: Water heater replacement - Sam Smith');
  assert.match(e.eventDescription, /CALLBACK REQUEST \(not a job visit\)/); assert.match(e.eventDescription, /Typically \$1,800/);
  assert.equal(e.calendarWhen, 'Tuesday, October 13 at 2:00 PM'); assert.match(e.body, /On the calendar as a callback for: Tuesday, October 13 at 2:00 PM/);
  assert.equal(e.calendarId, config.calendarId);
});
test('no day/time means the next time the office is open', () => {
  const e = build(config, base, NOW);
  assert.equal(e.eventStart, '2026-10-12T12:00:00-05:00');   // 10:00 now + 2h notice
  assert.match(e.body, /next time the office is open/);
});
test('after hours rolls to the next morning', () => {
  const e = build(config, base, Date.parse('2026-10-13T02:30:00Z'));   // Mon 9:30 PM Chicago
  assert.equal(e.eventStart, '2026-10-13T08:00:00-05:00');
});
test('a time in the past or a malformed time falls back safely', () => {
  assert.match(build(config, { ...base, callback_date: '2026-10-01', callback_time: '09:00' }, NOW).body, /next time the office is open/);
  assert.match(build(config, { ...base, callback_date: 'tomorrow', callback_time: '2pm' }, NOW).body, /next time the office is open/);
});
test('missing fields do not crash; header injection stripped; callbackEmail overrides owner', () => {
  const e = build({ ...config, callbackEmail: 'office@example.com' }, { name: 'X\r\nBcc: evil@x.com' }, NOW);
  assert.equal(e.to, 'office@example.com'); assert.doesNotMatch(e.subject, /[\r\n]/); assert.match(e.body, /as soon as possible/);
});
test('callback entries are marked Free so they never block technician time', async () => {
  const S = (await import('node:module')).createRequire(import.meta.url)('../n8n/code/slots.js');
  assert.equal(S.busyFromEvents([{ transparency: 'transparent', start: { dateTime: '2026-10-13T14:00:00-05:00' }, end: { dateTime: '2026-10-13T14:15:00-05:00' } }], config.timeZone).length, 0);
});
test('big job books a short ESTIMATE visit, not the whole job', async () => {
  const S = (await import('node:module')).createRequire(import.meta.url)('../n8n/code/slots.js');
  assert.equal(S.isBigJob(config, 'Water heater replacement'), true); assert.equal(S.isBigJob(config, 'Clogged toilet'), false);
  assert.equal(S.durationFor(config, 'Water heater replacement'), 60);
});
await new Promise((r) => setTimeout(r, 50));
console.log(`\n${n} tests passed`);
