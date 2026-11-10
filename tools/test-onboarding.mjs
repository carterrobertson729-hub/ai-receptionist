import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { onboardingDue, obToday, obDays, obRow } = require('../n8n/code/onboarding.js');
let n = 0; const test = (t, f) => { f(); n++; console.log('ok  ' + t); };
const cfg = { ownerEmail: 'me@x.com', siteUrl: 'https://site.example', tz: 'America/Chicago', nowMs: Date.parse('2026-11-10T15:00:00Z') };
const row = (live, extra) => Object.assign({ Name: 'Sam Lee', Email: 'sam@x.com', Business: 'Sam Cuts', Plan: 'Backup Lite', 'Live date': live, 'Receptionist number': '(219) 555-0100' }, extra);
test('today is the Chicago calendar date, not UTC', () => {
  assert.equal(obToday(Date.parse('2026-11-10T03:30:00Z'), 'America/Chicago'), '2026-11-09');
  assert.equal(obToday(Date.parse('2026-11-10T15:00:00Z'), 'America/Chicago'), '2026-11-10');
});
test('days since live date, and bad dates are ignored', () => {
  assert.equal(obDays('2026-11-03', '2026-11-10'), 7); assert.equal(obDays('2026-10-11', '2026-11-10'), 30); assert.equal(obDays('11/10/2026', '2026-11-10'), null);
});
test('day 0, 7 and 30 each send the right email to the customer plus a copy line to the owner', () => {
  const live = onboardingDue([row('2026-11-10')], cfg), week = onboardingDue([row('2026-11-03')], cfg), month = onboardingDue([row('2026-10-11')], cfg);
  assert.equal(live.length, 2); assert.equal(live[0].to, 'sam@x.com'); assert.equal(live[0].subject, 'Your receptionist is live');
  assert.match(live[0].body, /^Hi Sam,/); assert.match(live[0].body, /\(219\) 555-0100/); assert.match(live[0].body, /site\.example\/change-request\.html/); assert.match(live[0].body, /site\.example\/support\.html/);
  assert.equal(live[1].to, 'me@x.com'); assert.match(live[1].subject, /^Sent to Sam Cuts/);
  assert.equal(week[0].subject, 'How is your first week going?'); assert.equal(month[0].subject, 'Your first month with AnswerBay');
});
test('other days, missing or bad emails and bad dates send nothing; duplicates send once', () => {
  assert.equal(onboardingDue([row('2026-11-09'), row('2026-11-01'), row('2026-11-11')], cfg).length, 0);
  assert.equal(onboardingDue([row('2026-11-10', { Email: '' }), row('2026-11-10', { Email: 'nope' }), row('soon')], cfg).length, 0);
  assert.equal(onboardingDue([row('2026-11-10'), row('2026-11-10')], cfg).length, 2);
});
test('column names are forgiving (case, spaces, punctuation) and number is optional', () => {
  const r = obRow({ ' NAME ': 'A B', 'E-mail': 'a@x.com' }); assert.equal(r.name, 'A B');
  const out = onboardingDue([{ name: 'Al', email: 'al@x.com', business: 'Al Co', 'go-live': '2026-11-10' }], cfg);
  assert.equal(out.length, 2); assert.doesNotMatch(out[0].body, /Its number is/);
});
console.log(n + ' tests passed');
