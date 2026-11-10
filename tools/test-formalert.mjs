import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { formAlert } = require('../n8n/code/formalert.js');
let n = 0; const test = (t, f) => { f(); n++; console.log('ok  ' + t); };
const opts = { secret: 'k', skip: ['demo'], ownerEmail: 'me@x.com' };
const mk = (form, data, extra) => ({ query: { key: 'k' }, body: Object.assign({ payload: Object.assign({ form_name: form, data }, extra) }) });
test('setup form: subject has business and plan, body lists every filled answer, empty ones are left out', () => {
  const r = formAlert(mk('setup', { 'form-name': 'setup', name: 'Sam', email: 's@x.com', business_name: 'Lee Cuts', plan: 'Backup Lite', notes: '', hours_mon: '9-5' }), opts);
  assert.equal(r.ok, true); assert.equal(r.to, 'me@x.com'); assert.equal(r.replyTo, 's@x.com');
  assert.equal(r.subject, 'NEW SETUP FORM: Lee Cuts (Backup Lite)');
  assert.match(r.body, /Business name: Lee Cuts/); assert.match(r.body, /Hours mon: 9-5/); assert.doesNotMatch(r.body, /Notes/); assert.doesNotMatch(r.body, /Form-name/);
  assert.match(r.body, /paste these answers to Claude/);
});
test('uses ordered_human_fields (nice titles, original order) when Netlify sends them', () => {
  const r = formAlert(mk('contact', { name: 'Ann', message: 'hi' }, { ordered_human_fields: [{ title: 'Your name', name: 'name', value: 'Ann' }, { title: 'Message', name: 'message', value: 'Hello there' }, { title: 'x', name: 'bot-field', value: 'spam' }] }), opts);
  assert.match(r.body, /Your name: Ann\nMessage: Hello there/); assert.doesNotMatch(r.body, /spam/); assert.equal(r.subject, 'Website message from Ann');
});
test('order, waitlist, signup and unknown forms each get a clear subject', () => {
  assert.equal(formAlert(mk('order', { name: 'B', plan: 'Standard' }), opts).subject, 'Plan reserved: B - Standard');
  assert.match(formAlert(mk('order', { name: 'B' }), opts).body, /Stripe invoice/);
  assert.equal(formAlert(mk('waitlist', { business: 'Auto Co' }), opts).subject, 'Waitlist sign-up: Auto Co');
  assert.equal(formAlert(mk('signup', { email: 'z@x.com' }), opts).subject, 'New website sign-up: z@x.com');
  assert.equal(formAlert(mk('mystery', { email: 'q@x.com' }), opts).subject, 'Website form "mystery": q@x.com');
});
test('demo form is skipped (its own workflow handles it); wrong key and missing form name are rejected', () => {
  assert.equal(formAlert(mk('demo', { name: 'D' }), opts).reason, 'skipped_form');
  assert.equal(formAlert({ query: { key: 'no' }, body: mk('setup', {}).body }, opts).reason, 'bad_key');
  assert.equal(formAlert({ query: { key: 'k' }, body: { payload: { data: {} } } }, opts).reason, 'no_form_name');
});
test('accepts a body without the payload wrapper', () => {
  const r = formAlert({ query: { key: 'k' }, body: { form_name: 'contact', data: { name: 'W', email: 'w@x.com' } } }, opts);
  assert.equal(r.ok, true); assert.match(r.body, /Reply to: w@x.com/);
});
test('accepts the copy our website sends itself (payload as a JSON string, urlencoded body)', () => {
  const r = formAlert({ query: { key: 'k' }, body: { payload: JSON.stringify({ form_name: 'setup', data: { name: 'Zed', business_name: 'Zed Cuts', plan: 'backup-lite' } }) } }, opts);
  assert.equal(r.ok, true); assert.equal(r.subject, 'NEW SETUP FORM: Zed Cuts (backup-lite)');
  assert.equal(formAlert({ query: { key: 'k' }, body: { payload: '{oops' } }, opts).reason, 'bad_payload');
});
test('returns the website the customer typed, so the workflow can read it', () => {
  const r = formAlert(mk('setup', { name: 'Q', business_name: 'Q Cuts', website: 'https://qcuts.com' }), opts);
  assert.equal(r.website, 'https://qcuts.com');
});
test('change requests get their own subject; setup forms with an email also get a customer receipt', () => {
  const c = formAlert(mk('change', { business_name: 'Q Cuts', name: 'Q', email: 'q@x.com', change_type: 'Prices or services', details: 'Fade is now $32' }), opts);
  assert.equal(c.subject, 'CHANGE REQUEST: Q Cuts - Prices or services'); assert.match(c.body, /Fade is now \$32/); assert.equal(c.customer, null);
  const o2 = Object.assign({}, opts, { shareEmail: 'cal@x.com', siteUrl: 'https://s.example' });
  const r = formAlert(mk('setup', { name: 'Sam Lee', email: 's@x.com', business_name: 'Sam Cuts' }), o2);
  assert.equal(r.customer.to, 's@x.com'); assert.match(r.customer.body, /^Hi Sam,/); assert.match(r.customer.body, /cal@x\.com/); assert.match(r.customer.body, /s\.example\/change-request\.html/);
  assert.equal(formAlert(mk('setup', { name: 'No Mail', business_name: 'B' }), o2).customer, null);
  assert.equal(formAlert(mk('setup', { name: 'Bad', email: 'not an email' }), o2).customer, null);
  assert.equal(formAlert(mk('contact', { name: 'C', email: 'c@x.com' }), o2).customer, null);
});
console.log(n + ' tests passed');
