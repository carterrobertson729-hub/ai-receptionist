// Website form alerts: turns any Netlify form submission into one plain email to the owner.
// Self-contained; unit-tested by tools/test-formalert.mjs.

function faClean(v) { return String(v == null ? '' : v).replace(/\r/g, '').trim(); }

function faLabel(key) {
  var s = String(key || '').replace(/[_-]+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Field';
}

// input: the webhook item ({ body, query }). opts: { secret, skip: ['demo'], ownerEmail }.
function formAlert(input, opts) {
  var query = (input && input.query) || {};
  var body = (input && input.body) || input || {};
  var sub = body.payload || body;                 // Netlify wraps the submission differently by notification type
  if (typeof sub === 'string') { try { sub = JSON.parse(sub); } catch (e) { return { ok: false, reason: 'bad_payload' }; } }   // our own website sends the copy as a JSON string
  var d = sub.data || {};
  if (opts.secret && query.key !== opts.secret) return { ok: false, reason: 'bad_key' };
  var formName = faClean(sub.form_name || body.form_name || d['form-name']);
  if (!formName) return { ok: false, reason: 'no_form_name' };
  if ((opts.skip || []).indexOf(formName) !== -1) return { ok: false, reason: 'skipped_form', formName: formName };

  var hidden = { 'form-name': 1, 'bot-field': 1, ip: 1, user_agent: 1, referrer: 1 };
  var rows = [];
  var ordered = sub.ordered_human_fields;
  if (ordered && ordered.length) {
    ordered.forEach(function (f) {
      if (!f || hidden[f.name]) return;
      var v = faClean(f.value);
      if (v) rows.push([faClean(f.title) || faLabel(f.name), v]);
    });
  } else {
    Object.keys(d).forEach(function (k) {
      if (hidden[k]) return;
      var v = faClean(d[k]);
      if (v) rows.push([faLabel(k), v]);
    });
  }
  function pick(names) {
    for (var i = 0; i < names.length; i++) { var v = faClean(d[names[i]]); if (v) return v; }
    return '';
  }
  var name = pick(['name', 'your_name', 'full_name']);
  var email = pick(['email', 'your_email']);
  var business = pick(['business_name', 'business', 'shop']);
  var plan = pick(['plan', 'plan_name']);

  var subject, next = '';
  if (formName === 'setup') {
    subject = 'NEW SETUP FORM: ' + (business || name || 'a customer') + (plan ? ' (' + plan + ')' : '');
    next = '\n\nNext: paste these answers to Claude to build their receptionist. Check Stripe to confirm they paid before you build.';
  } else if (formName === 'order') {
    subject = 'Plan reserved: ' + (name || email || 'a visitor') + (plan ? ' - ' + plan : '');
    next = '\n\nNext: send them a Stripe invoice or payment link (plan plus $99 setup), then the setup form link.';
  } else if (formName === 'contact') {
    subject = 'Website message from ' + (name || email || 'a visitor');
  } else if (formName === 'waitlist') {
    subject = 'Waitlist sign-up: ' + (business || name || email || 'a visitor');
  } else if (formName === 'signup') {
    subject = 'New website sign-up: ' + (name || email || 'a visitor');
  } else {
    subject = 'Website form "' + formName + '": ' + (name || email || business || 'new submission');
  }

  var text = 'A form was sent on your website.\nForm: ' + formName + (email ? '\nReply to: ' + email : '') + '\n\n' +
    rows.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n') + next;
  return { ok: true, formName: formName, to: opts.ownerEmail, replyTo: email, subject: subject, body: text, website: pick(['website']) };
}

if (typeof module !== 'undefined') module.exports = { formAlert: formAlert };
