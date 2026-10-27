import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { demoParse, demoConflict, demoEmails, demoBusy, demoEventInfo, demoCancelEmails } = require('../n8n/code/demo.js');
let n = 0; const test = (t, f) => { f(); n++; console.log('ok  ' + t); };
const opts = { secret: 'k1', tz: 'America/Chicago', minutes: 20, nowMs: Date.parse('2026-10-26T12:00:00Z') };
const cfg = { ownerEmail: 'me@x.com', tzLabel: 'Central Time', minutes: 20, demoLine: '(219) 587-7319' };
const sub = (data, extra) => ({ query: { key: 'k1' }, body: Object.assign({ form_name: 'demo', data: Object.assign({ date: '2026-10-28', time: '3:30 PM Central Time', name: 'Sam Lee', email: 's@x.com', phone: '555', business: 'Lee Cuts', business_type: 'Barbershop or salon', local_time: '4:30 PM EDT' }, data) }, extra) });
test('parses a Netlify submission into UTC time and a Central ISO string (CDT = -05:00)', () => {
  const p = demoParse(sub({}), opts);
  assert.equal(p.ok, true); assert.equal(p.startIso, '2026-10-28T15:30:00-05:00'); assert.equal(p.endIso, '2026-10-28T15:50:00-05:00');
  assert.equal(p.startMs, Date.parse('2026-10-28T20:30:00Z')); assert.match(p.label, /Wednesday, October 28 at 3:30 PM/);
});
test('winter time uses -06:00', () => {
  const p = demoParse(sub({ date: '2026-12-05', time: '8:00 AM Central Time' }), opts);
  assert.equal(p.startIso, '2026-12-05T08:00:00-06:00');
});
test('accepts the payload wrapper and 12 PM / 12 AM edge cases', () => {
  const p = demoParse({ query: { key: 'k1' }, body: { payload: { form_name: 'demo', data: { date: '2026-10-28', time: '12:30 PM Central Time', name: 'A' } } } }, opts);
  assert.equal(p.ok, true); assert.equal(p.startIso, '2026-10-28T12:30:00-05:00');
});
test('rejects wrong key, wrong form, missing time and past time', () => {
  assert.equal(demoParse({ query: { key: 'no' }, body: sub({}).body }, opts).reason, 'bad_key');
  assert.equal(demoParse(sub({}, { form_name: 'contact' }), opts).reason, 'not_demo_form');
  assert.equal(demoParse(sub({ time: '' }), opts).reason, 'no_time');
  assert.equal(demoParse(sub({ date: '2026-10-20' }), opts).reason, 'in_the_past');
});
test('conflict: overlapping busy events block, free/all-day/cancelled ones do not', () => {
  const s = Date.parse('2026-10-28T20:30:00Z'), e = s + 20 * 60000;
  const ev = (a, b, x) => Object.assign({ summary: 'Busy', start: { dateTime: a }, end: { dateTime: b } }, x);
  assert.equal(demoConflict([ev('2026-10-28T15:00:00-05:00', '2026-10-28T16:00:00-05:00')], s, e), 'Busy');
  assert.equal(demoConflict([ev('2026-10-28T15:50:00-05:00', '2026-10-28T16:30:00-05:00')], s, e), '');
  assert.equal(demoConflict([ev('2026-10-28T15:00:00-05:00', '2026-10-28T16:00:00-05:00', { transparency: 'transparent' })], s, e), '');
  assert.equal(demoConflict([{ summary: 'Holiday', start: { date: '2026-10-28' }, end: { date: '2026-10-29' } }], s, e), '');
  assert.equal(demoConflict([ev('2026-10-28T15:00:00-05:00', '2026-10-28T16:00:00-05:00', { status: 'cancelled' })], s, e), '');
});
test('booked: two emails, owner first, visitor gets the demo line and phone', () => {
  const p = demoParse(sub({}), opts); const m = demoEmails(p, '', true, cfg);
  assert.equal(m.length, 2); assert.equal(m[0].to, 'me@x.com'); assert.match(m[0].subject, /New demo booked: Sam Lee/); assert.match(m[0].body, /Added to your calendar/);
  assert.equal(m[1].to, 's@x.com'); assert.match(m[1].body, /We will call you at 555/); assert.match(m[1].body, /\(219\) 587-7319/); assert.match(m[1].body, /4:30 PM EDT/);
});
test('no phone: asks for one. Calendar failure: warns the owner', () => {
  const p = demoParse(sub({ phone: '' }), opts); const m = demoEmails(p, '', false, cfg);
  assert.match(m[1].body, /did not leave a phone number/); assert.match(m[0].body, /WARNING/);
});
test('clash: owner told nothing was added, visitor asked for another time', () => {
  const p = demoParse(sub({}), opts); const m = demoEmails(p, 'Haircut', true, cfg);
  assert.match(m[0].subject, /CLASHES/); assert.match(m[1].subject, /pick another time/); assert.doesNotMatch(m[1].body, /is booked/);
});
test('booked emails carry a change/cancel link when the event id and site address are known', () => {
  const p = demoParse(sub({}, { site_url: 'https://my.netlify.app/' }), opts); const m = demoEmails(p, '', true, cfg, 'abc123');
  assert.match(m[1].body, /https:\/\/my\.netlify\.app\/demo-change\.html\?e=abc123/); assert.match(m[0].body, /demo-change\.html\?e=abc123/);
  const m2 = demoEmails(demoParse(sub({}), opts), '', true, cfg, 'abc123');   // no site address anywhere
  assert.doesNotMatch(m2[1].body, /demo-change/); assert.match(m2[1].body, /reply to this email/);
  const m3 = demoEmails(demoParse(sub({}), opts), '', true, Object.assign({ siteUrl: 'https://x.app' }, cfg), 'zz');
  assert.match(m3[1].body, /https:\/\/x\.app\/demo-change\.html\?e=zz/);
});
test('busy list: timed busy events only', () => {
  const ev = (a, b, x) => Object.assign({ start: { dateTime: a }, end: { dateTime: b } }, x);
  const b = demoBusy([ev('2026-10-28T17:30:00-05:00', '2026-10-28T17:50:00-05:00'), ev('2026-10-28T09:00:00-05:00', '2026-10-28T10:00:00-05:00', { transparency: 'transparent' }), { start: { date: '2026-10-28' }, end: { date: '2026-10-29' } }, ev('2026-10-28T11:00:00-05:00', '2026-10-28T12:00:00-05:00', { status: 'cancelled' })]);
  assert.equal(b.length, 1); assert.equal(b[0].s, Date.parse('2026-10-28T22:30:00Z')); assert.equal(b[0].e - b[0].s, 20 * 60000);
});
test('event info: only future DEMO events can be looked up or cancelled', () => {
  const now = Date.parse('2026-10-26T12:00:00Z');
  const ev = (x) => Object.assign({ id: 'a1', summary: 'DEMO: Sam Lee (Lee Cuts)', description: 'Booked on the website\nName: Sam Lee\nEmail: s@x.com', start: { dateTime: '2026-10-28T15:30:00-05:00' }, end: { dateTime: '2026-10-28T15:50:00-05:00' } }, x);
  const i = demoEventInfo(ev({}), 'America/Chicago', now);
  assert.equal(i.ok, true); assert.equal(i.name, 'Sam Lee (Lee Cuts)'); assert.equal(i.email, 's@x.com'); assert.match(i.label, /Wednesday, October 28 at 3:30 PM/);
  assert.equal(demoEventInfo(ev({ summary: 'Dentist' }), 'America/Chicago', now).reason, 'not_found');
  assert.equal(demoEventInfo(ev({ status: 'cancelled' }), 'America/Chicago', now).reason, 'already_cancelled');
  assert.equal(demoEventInfo(ev({}), 'America/Chicago', Date.parse('2026-10-29T00:00:00Z')).reason, 'in_the_past');
  assert.equal(demoEventInfo({}, 'America/Chicago', now).reason, 'not_found');
});
test('cancel emails: owner always, visitor when their email is known', () => {
  const m = demoCancelEmails({ name: 'Sam', label: 'Wednesday, October 28 at 3:30 PM', email: 's@x.com' }, cfg);
  assert.equal(m.length, 2); assert.equal(m[0].to, 'me@x.com'); assert.equal(m[1].to, 's@x.com');
  assert.equal(demoCancelEmails({ name: 'Sam', label: 'x', email: '' }, cfg).length, 1);
});
console.log(n + ' tests passed');
