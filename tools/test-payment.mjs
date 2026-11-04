import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { paymentWelcome, payGuessPlan } = require('../n8n/code/payment.js');
let n = 0; const test = (t, f) => { f(); n++; console.log('ok  ' + t); };
const plans = [{ id: 'backup-lite', name: 'Backup Lite', monthly: 59 }, { id: 'backup-standard', name: 'Backup Standard', monthly: 89 }, { id: 'always-high', name: '24/7 High volume', monthly: 349 }];
const opts = { secret: 'k', siteUrl: 'https://site.example/', ownerEmail: 'me@x.com', plans, setupFee: 99, discount: 0.1 };
const ev = (obj, extra) => ({ query: { key: 'k' }, body: Object.assign({ type: 'checkout.session.completed', livemode: true, data: { object: Object.assign({ id: 'cs_1', payment_status: 'paid', amount_total: 18800, customer_details: { email: 'sam@x.com', name: 'Sam Lee' } }, obj) } }, extra) });
test('plan guess: monthly with setup fee, monthly alone, yearly with setup fee', () => {
  assert.deepEqual(payGuessPlan(188, plans, 99, 0.1), { id: 'backup-standard', name: 'Backup Standard', cycle: 'monthly', includesSetup: true });
  assert.equal(payGuessPlan(59, plans, 99, 0.1).id, 'backup-lite');
  const y = payGuessPlan(Math.floor(349 * 12 * 0.9) + 99, plans, 99, 0.1);
  assert.equal(y.id, 'always-high'); assert.equal(y.cycle, 'yearly'); assert.equal(y.includesSetup, true);
  assert.equal(payGuessPlan(7, plans, 99, 0.1), null); assert.equal(payGuessPlan(null, plans, 99, 0.1), null);
});
test('paid checkout: customer gets the setup link with plan, email and name filled in; owner gets a PAID note', () => {
  const r = paymentWelcome(ev({}), opts);
  assert.equal(r.ok, true); assert.equal(r.messages.length, 2);
  const [c, o] = r.messages;
  assert.equal(c.to, 'sam@x.com'); assert.match(c.body, /^Hi Sam,/);
  assert.match(c.body, /https:\/\/site\.example\/setup\.html\?plan=backup-standard&cycle=monthly&email=sam%40x\.com&name=Sam%20Lee/);
  assert.match(c.body, /4 business days/);
  assert.equal(o.to, 'me@x.com'); assert.equal(o.subject, 'PAID: Sam Lee - $188 (Backup Standard)'); assert.match(o.body, /setup fee included/);
});
test('unknown amount still sends the link (no plan params) and tells the owner to check Stripe', () => {
  const r = paymentWelcome(ev({ amount_total: 12345 }), opts);
  assert.doesNotMatch(r.messages[0].body, /plan=/); assert.match(r.messages[1].body, /cannot tell/);
});
test('test-mode payments are marked; no email on file means owner-only message', () => {
  const t = paymentWelcome(ev({}, { livemode: false }), opts); assert.match(t.messages[1].subject, /^\[TEST\] PAID/);
  const r = paymentWelcome(ev({ customer_details: {} }), opts);
  assert.equal(r.messages.length, 1); assert.equal(r.messages[0].to, 'me@x.com'); assert.match(r.messages[0].body, /NOT GIVEN/);
});
test('ignores other events, unpaid sessions and wrong keys', () => {
  assert.equal(paymentWelcome(ev({}, { type: 'invoice.paid' }), opts).reason, 'ignored_event');
  assert.equal(paymentWelcome(ev({ payment_status: 'unpaid' }), opts).reason, 'not_paid');
  assert.equal(paymentWelcome({ query: { key: 'bad' }, body: ev({}).body }, opts).reason, 'bad_key');
});
console.log(n + ' tests passed');
