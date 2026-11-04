// PASTE INTO n8n: workflow "Website - Payment Welcome" > node "Build Welcome Emails" > Code tab (select all, replace, Save).
// Stripe payment welcome: when a customer's checkout is paid, build (1) an email to the customer with their
// setup-form link and what happens next, and (2) an email to the owner saying who paid.
// Self-contained; unit-tested by tools/test-payment.mjs.

function payMoney(n) { return '$' + (Math.round(n * 100) % 100 === 0 ? Math.round(n).toLocaleString('en-US') : n.toFixed(2)); }

// Which plan does this amount look like? Matches plan price alone or plus the setup fee, monthly or yearly.
function payGuessPlan(amount, plans, setupFee, discount) {
  if (typeof amount !== 'number' || !isFinite(amount)) return null;
  for (var i = 0; i < plans.length; i++) {
    var p = plans[i];
    var yearly = Math.floor(p.monthly * 12 * (1 - discount));
    var tries = [[p.monthly, 'monthly'], [p.monthly + setupFee, 'monthly'], [yearly, 'yearly'], [yearly + setupFee, 'yearly']];
    for (var j = 0; j < tries.length; j++) {
      if (Math.abs(tries[j][0] - amount) < 0.005) return { id: p.id, name: p.name, cycle: tries[j][1], includesSetup: j % 2 === 1 };
    }
  }
  return null;
}

// input: the webhook item ({ body, query }) holding a Stripe event. opts: { secret, siteUrl, ownerEmail, plans, setupFee, discount }.
function paymentWelcome(input, opts) {
  var query = (input && input.query) || {};
  var ev = (input && input.body) || input || {};
  if (opts.secret && query.key !== opts.secret) return { ok: false, reason: 'bad_key' };
  if (ev.type !== 'checkout.session.completed') return { ok: false, reason: 'ignored_event', type: ev.type || '' };
  var s = (ev.data && ev.data.object) || {};
  if (s.payment_status && s.payment_status !== 'paid' && s.payment_status !== 'no_payment_required') return { ok: false, reason: 'not_paid' };

  var cd = s.customer_details || {};
  var email = String(cd.email || s.customer_email || '').trim();
  var name = String(cd.name || '').trim();
  var first = name.split(/\s+/)[0] || '';
  var amount = typeof s.amount_total === 'number' ? s.amount_total / 100 : null;
  var guess = payGuessPlan(amount, opts.plans, opts.setupFee, opts.discount);
  var test = ev.livemode === false;

  var q = [];
  if (guess) { q.push('plan=' + encodeURIComponent(guess.id)); q.push('cycle=' + guess.cycle); }
  if (email) q.push('email=' + encodeURIComponent(email));
  if (name) q.push('name=' + encodeURIComponent(name));
  var link = String(opts.siteUrl || '').replace(/\/+$/, '') + '/setup.html' + (q.length ? '?' + q.join('&') : '');

  var out = [];
  if (email) {
    out.push({ to: email, subject: 'Thank you! Your next step: tell us about your business',
      body: 'Hi ' + (first || 'there') + ',\n\n' +
        'Thank you for your order. Your payment went through, and Stripe is sending your receipt separately.\n\n' +
        'Your next step takes about 15 to 20 minutes. Fill in your setup form so we know how your business works:\n' + link + '\n\n' +
        'What happens next:\n' +
        '1. You send the setup form. Your answers reach us right away.\n' +
        '2. We build and test your receptionist. Most are live within about 4 business days after we get your form.\n' +
        '3. We email you your receptionist\'s phone number and the steps to forward your calls, and we run a test call together.\n\n' +
        'Handy to have ready: your hours, your services and prices, who has the login for your phone account, and the Google account your calendar uses (we will ask you to share the calendar with us).\n\n' +
        'If you are not sure about an answer, write "not sure" and we will suggest a sensible default. Questions? Just reply to this email.\n\nThe AnswerBay team' });
  }
  var lines = [
    (test ? 'TEST MODE payment (no real money).\n' : '') + 'A customer paid.',
    'Name: ' + (name || 'not given'),
    'Email: ' + (email || 'NOT GIVEN (Stripe did not send one, contact them yourself)'),
    'Amount: ' + (amount == null ? 'unknown' : payMoney(amount)),
    'Looks like: ' + (guess ? guess.name + ' (' + guess.cycle + (guess.includesSetup ? ', setup fee included' : '') + ')' : 'cannot tell (add-ons or tax can change the amount). Check the payment in Stripe.'),
    'Stripe payment id: ' + (s.id || 'unknown'),
    '',
    email ? 'I emailed them this setup link:\n' + link : 'Send them this setup link yourself:\n' + link,
    '',
    'Next: wait for their setup form (you get a "NEW SETUP FORM" email). If it has not arrived in a day, email them. Add any add-ons they bought in Stripe.'
  ];
  out.push({ to: opts.ownerEmail, subject: (test ? '[TEST] ' : '') + 'PAID: ' + (name || email || 'a customer') + (amount == null ? '' : ' - ' + payMoney(amount)) + (guess ? ' (' + guess.name + ')' : ''), body: lines.join('\n') });
  return { ok: true, messages: out };
}


// Keep this list in step with PLANS in website/site.js (id, name, monthly price).
var SETTINGS = {
  secret: 'PUT-YOUR-PAYMENT-KEY-HERE',
  siteUrl: 'https://endearing-macaron-e2b7a6.netlify.app',
  ownerEmail: 'carter.robertson729@gmail.com',
  setupFee: 99, discount: 0.10,
  plans: [
    { id: 'backup-lite', name: 'Backup Lite', monthly: 59 }, { id: 'backup-standard', name: 'Backup Standard', monthly: 89 }, { id: 'backup-plus', name: 'Backup Plus', monthly: 139 },
    { id: 'always-starter', name: '24/7 Starter', monthly: 119 }, { id: 'always-standard', name: '24/7 Standard', monthly: 179 }, { id: 'always-plus', name: '24/7 Plus', monthly: 239 }, { id: 'always-high', name: '24/7 High volume', monthly: 349 }
  ]
};
var r = paymentWelcome($input.first().json, SETTINGS);
if (!r.ok) return [{ json: r }];
return r.messages.map(function (m) { return { json: { ok: true, to: m.to, subject: m.subject, body: m.body } }; });
