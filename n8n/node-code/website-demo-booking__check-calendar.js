// PASTE INTO n8n: workflow "Website - Demo Booking" > node "Check Calendar" > Code tab (select all, replace, Save).
// Website demo bookings: turns a Netlify "demo" form submission into a calendar slot and emails.
// Self-contained (no other helpers needed). Unit-tested by tools/test-demo.mjs.

function demoZoneParts(ms, tz) {
  var o = {};
  new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(ms)).forEach(function (p) { o[p.type] = p.value; });
  return o;
}

// The real moment in time when it is y-m-d hh:mm on the clock in tz.
function demoInstant(y, m, d, hh, mm, tz) {
  var guess = Date.UTC(y, m - 1, d, hh, mm), p = demoZoneParts(guess, tz);
  var asIfUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return guess - (asIfUtc - guess);
}

function demoPad(n) { return ('0' + n).slice(-2); }

// 2026-10-28T15:30:00-05:00 style string for a moment in tz.
function demoLocalIso(ms, tz) {
  var p = demoZoneParts(ms, tz);
  var asIfUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  var off = Math.round((asIfUtc - ms) / 60000), a = Math.abs(off);
  return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute + ':00' + (off < 0 ? '-' : '+') + demoPad(Math.floor(a / 60)) + ':' + demoPad(a % 60);
}

function demoLabel(ms, tz) {
  var day = new Date(ms).toLocaleDateString('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' });
  var time = new Date(ms).toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
  return day + ' at ' + time;
}

// input: the webhook item ({ body, query }). opts: { secret, tz, minutes, nowMs }.
function demoParse(input, opts) {
  var query = (input && input.query) || {};
  var body = (input && input.body) || input || {};
  var sub = body.payload || body;                       // Netlify wraps the submission differently depending on the notification type
  var d = sub.data || {};
  var formName = sub.form_name || body.form_name || d['form-name'] || '';
  if (opts.secret && query.key !== opts.secret) return { ok: false, reason: 'bad_key' };
  if (formName !== 'demo') return { ok: false, reason: 'not_demo_form' };
  var dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d.date || ''));
  var tm = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(String(d.time || ''));
  if (!dm || !tm) return { ok: false, reason: 'no_time' };
  var h = +tm[1] % 12 + (/pm/i.test(tm[3]) ? 12 : 0);
  var startMs = demoInstant(+dm[1], +dm[2], +dm[3], h, +tm[2], opts.tz);
  var endMs = startMs + opts.minutes * 60000;
  if (startMs < opts.nowMs) return { ok: false, reason: 'in_the_past' };
  return {
    ok: true,
    name: String(d.name || '').trim(), email: String(d.email || '').trim(), phone: String(d.phone || '').trim(),
    business: String(d.business || '').trim(), businessType: String(d.business_type || '').trim(), notes: String(d.notes || '').trim(),
    visitorLocal: String(d.local_time || '').trim(), siteUrl: String(sub.site_url || body.site_url || '').trim(),
    startMs: startMs, endMs: endMs,
    startIso: demoLocalIso(startMs, opts.tz), endIso: demoLocalIso(endMs, opts.tz),
    label: demoLabel(startMs, opts.tz)
  };
}

// Is another real (busy, timed) event overlapping the demo slot? Returns its title, or '' if the slot is free.
function demoConflict(events, startMs, endMs) {
  for (var i = 0; i < events.length; i++) {
    var e = events[i];
    if (!e || !e.start || !e.start.dateTime) continue;      // all-day events do not block
    if (e.transparency === 'transparent' || e.status === 'cancelled') continue;
    var s = Date.parse(e.start.dateTime), t = Date.parse(e.end && e.end.dateTime);
    if (s < endMs && t > startMs) return e.summary || 'another event';
  }
  return '';
}

// p = demoParse result, clash = title from demoConflict ('' if none), calendarOk = false if creating the event failed.
function demoEmails(p, clash, calendarOk, cfg, eventId) {
  var first = (p.name || 'there').split(/\s+/)[0];
  var tzLabel = cfg.tzLabel;
  var when = p.label + ' ' + tzLabel;
  var details = [
    'Name: ' + p.name, 'Email: ' + p.email, 'Phone: ' + (p.phone || 'not given'),
    'Business: ' + (p.business || 'not given') + (p.businessType ? ' (' + p.businessType + ')' : ''),
    'Notes: ' + (p.notes || 'none'), p.visitorLocal ? 'Their local time: ' + p.visitorLocal : ''
  ].filter(Boolean).join('\n');
  var base = String(cfg.siteUrl || p.siteUrl || '').replace(/\/+$/, '');
  var manage = eventId && base ? base + '/demo-change.html?e=' + encodeURIComponent(eventId) : '';
  var out = [];
  if (clash) {
    out.push({ to: cfg.ownerEmail, subject: 'Demo request CLASHES with your calendar: ' + p.name + ', ' + when,
      body: 'Someone asked for a demo at ' + when + ', but your calendar already has "' + clash + '" then. Nothing was added. They were told the time is taken and asked for another.\n\n' + details });
    if (p.email) out.push({ to: p.email, subject: 'Your AnswerBay demo: please pick another time',
      body: 'Hi ' + first + ',\n\nThanks for asking for a demo. The time you picked (' + when + ') was just taken. Please reply to this email with a couple of times that work for you, or pick another time on our website, and we will confirm.\n\nThe AnswerBay team' });
    return out;
  }
  out.push({ to: cfg.ownerEmail, subject: 'New demo booked: ' + p.name + ', ' + when,
    body: (calendarOk ? 'Added to your calendar.' : 'WARNING: the calendar event could not be created. Add it yourself.') + '\n\nWhen: ' + when + ' (' + cfg.minutes + ' minutes, phone call)\n' + details + (manage ? '\n\nThey can change or cancel with this link (it frees the time): ' + manage : '') });
  if (p.email) out.push({ to: p.email, subject: 'Your AnswerBay demo is booked: ' + when,
    body: 'Hi ' + first + ',\n\nYour AnswerBay demo is booked for ' + when + (p.visitorLocal ? ' (' + p.visitorLocal + ' in your time zone)' : '') + '. It is a ' + cfg.minutes + '-minute phone call.\n\n' +
      (p.phone ? 'We will call you at ' + p.phone + '.' : 'You did not leave a phone number, so please reply to this email with the best number to reach you.') +
      '\n\nWant to hear the receptionist before then? Call our barbershop demo line at ' + cfg.demoLine + ' and book a haircut.\n\n' + (manage ? 'Need to change or cancel? Use this link. It takes a few seconds and frees up the time: ' + manage : 'If you need to change the time, reply to this email.') + '\n\nThe AnswerBay team' });
  return out;
}

// Busy intervals (ms) from calendar events, for hiding taken times on the website.
function demoBusy(events) {
  var out = [];
  for (var i = 0; i < events.length; i++) {
    var e = events[i];
    if (!e || !e.start || !e.start.dateTime || !e.end || !e.end.dateTime) continue;
    if (e.transparency === 'transparent' || e.status === 'cancelled') continue;
    out.push({ s: Date.parse(e.start.dateTime), e: Date.parse(e.end.dateTime) });
  }
  return out;
}

// Look at a calendar event fetched by id. Only events this workflow made ("DEMO: ...") can be looked up or cancelled.
function demoEventInfo(ev, tz, nowMs) {
  if (!ev || !ev.id || !ev.start || !ev.start.dateTime) return { ok: false, reason: 'not_found' };
  if (ev.status === 'cancelled') return { ok: false, reason: 'already_cancelled' };
  if (String(ev.summary || '').indexOf('DEMO:') !== 0) return { ok: false, reason: 'not_found' };
  var startMs = Date.parse(ev.start.dateTime);
  if (startMs < nowMs) return { ok: false, reason: 'in_the_past' };
  var m = /^Email: (.*)$/m.exec(ev.description || '');
  return { ok: true, name: String(ev.summary).replace(/^DEMO:\s*/, ''), startMs: startMs, label: demoLabel(startMs, tz), email: m ? m[1].trim() : '' };
}

function demoCancelEmails(info, cfg) {
  var when = info.label + ' ' + cfg.tzLabel;
  var out = [{ to: cfg.ownerEmail, subject: 'Demo cancelled: ' + info.name + ', ' + when, body: info.name + ' cancelled their demo for ' + when + '. The time is open again and the calendar event was removed.' + (info.email ? '\nTheir email: ' + info.email : '') }];
  if (info.email) out.push({ to: info.email, subject: 'Your AnswerBay demo is cancelled', body: 'Your AnswerBay demo for ' + when + ' is cancelled and the time is released. You can book another time on our website whenever you like.\n\nThe AnswerBay team' });
  return out;
}


var p = $('Read Request').first().json;
var events = $input.all().map(function (i) { return i.json; }).filter(function (e) { return e && e.start; });
return [{ json: { clash: demoConflict(events, p.startMs, p.endMs) } }];
