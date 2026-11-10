// Onboarding emails: reads the "Customers" sheet once a day and sends the customer emails that are due
// (day 0 = "you're live", day 7 = check-in, day 30 = first month). Stateless: an email is due only on that exact day,
// so nothing needs to be written back to the sheet. Unit-tested by tools/test-onboarding.mjs.

function obKey(k) { return String(k || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

function obRow(raw) {
  var o = {};
  Object.keys(raw || {}).forEach(function (k) { o[obKey(k)] = String(raw[k] == null ? '' : raw[k]).trim(); });
  return { name: o.name || o.customername || '', email: o.email || o.customeremail || '', business: o.business || o.businessname || '',
    plan: o.plan || '', liveDate: o.livedate || o.golive || o.live || '', number: o.receptionistnumber || o.number || o.retellnumber || '', mode: o.mode || o.answermode || '' };
}

// "2026-11-10" in the given time zone for a moment in time.
function obToday(nowMs, tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(nowMs));
}

function obDays(liveDate, today) {
  var a = /^(\d{4})-(\d{2})-(\d{2})$/.exec(liveDate), b = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!a || !b) return null;
  return Math.round((Date.UTC(+b[1], +b[2] - 1, +b[3]) - Date.UTC(+a[1], +a[2] - 1, +a[3])) / 86400000);
}

function obBody(kind, c, cfg) {
  var first = (c.name || '').split(/\s+/)[0] || 'there';
  var biz = c.business || 'your business';
  var changeUrl = cfg.siteUrl + '/change-request.html', supportUrl = cfg.siteUrl + '/support.html';
  var sign = '\n\nThe AnswerBay team';
  if (kind === 'live') return { subject: 'Your receptionist is live', body: 'Hi ' + first + ',\n\nGood news: the receptionist for ' + biz + ' is switched on.' +
    (c.number ? '\n\nIts number is ' + c.number + '. Your customers keep calling your normal number. Calls are sent to it by your phone company.' : '') +
    '\n\nWhat to expect:\n- You get an email after calls that matter (bookings, messages, urgent calls).\n- Every Monday morning you get a short weekly report.\n- If a caller asks something it does not know, it takes a message instead of guessing.\n\n' +
    'A good first test: call your business number from a different phone while nobody answers, and see what happens. A short checklist is here: ' + supportUrl + '\n\n' +
    'Need to change prices, hours or a holiday closure? Use this form and we will update it: ' + changeUrl + '\nOr just reply to this email.' + sign };
  if (kind === 'week') return { subject: 'How is your first week going?', body: 'Hi ' + first + ',\n\nIt has been a week since the receptionist for ' + biz + ' went live. Quick check-in:\n\n' +
    '1. Are calls reaching it the way you expected?\n2. Did it say anything wrong or miss anything?\n3. Is there something you wish it did?\n\nJust reply with whatever comes to mind, even one line. If something needs fixing, tell us and we will fix it. You can also send changes here: ' + changeUrl + sign };
  return { subject: 'Your first month with AnswerBay', body: 'Hi ' + first + ',\n\nYour first month with the receptionist for ' + biz + ' is done. Your weekly reports have been showing how many calls it handled and how many bookings it made.\n\n' +
    'Two small favors, both optional:\n- If it has been useful, could you reply with one or two sentences about your experience? With your permission we may share it on our website.\n- Do you know another owner who misses calls? If you introduce us and they sign up, we will thank you.\n\nAnd if something is not working the way you hoped, tell us now. We would rather fix it.' + sign };
}

// rows: items from the Customers sheet. cfg: { ownerEmail, siteUrl, tz, nowMs }
function onboardingDue(rows, cfg) {
  var today = obToday(cfg.nowMs, cfg.tz);
  var out = [], seen = {};
  (rows || []).forEach(function (raw) {
    var c = obRow(raw);
    var days = obDays(c.liveDate, today);
    var kind = days === 0 ? 'live' : days === 7 ? 'week' : days === 30 ? 'month' : '';
    if (!kind || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email)) return;
    var key = c.email.toLowerCase() + '|' + kind;
    if (seen[key]) return; seen[key] = 1;
    var m = obBody(kind, c, cfg);
    out.push({ to: c.email, subject: m.subject, body: m.body });
    out.push({ to: cfg.ownerEmail, subject: 'Sent to ' + (c.business || c.email) + ': ' + m.subject, body: 'This email was sent automatically to ' + c.email + ' (day ' + days + ').\n\n----\n' + m.body });
  });
  return out;
}

if (typeof module !== 'undefined') module.exports = { onboardingDue: onboardingDue, obToday: obToday, obDays: obDays, obRow: obRow };
