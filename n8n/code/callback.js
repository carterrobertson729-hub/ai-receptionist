// Builds the "callback requested" email AND calendar entry for the office.
// Needs slots.js helpers (localToUtcMs, toLocalIso, allSlots, localDateStr, friendlyLabel) inlined before it.
// Unit-tested by tools/test-callback.mjs.

function buildCallbackEmail(config, args, nowMs) {
  function clean(v, fallback) {
    var t = v === undefined || v === null ? '' : String(v).replace(/[\r\n]+/g, ' ').trim();
    return t ? t.slice(0, 500) : fallback;
  }
  var name = clean(args.name, 'Unknown caller');
  var phone = clean(args.phone, 'not given');
  var address = clean(args.address, 'not given');
  var service = clean(args.service, 'Job');
  var problem = clean(args.problem, 'not given');
  var when = clean(args.preferred_callback_time, 'as soon as possible');
  var priceInfo = clean(args.price_discussed, 'none');
  var called = new Intl.DateTimeFormat('en-US', {
    timeZone: config.timeZone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  }).format(new Date(nowMs));
  var body = [
    'CALLBACK REQUESTED - ' + service,
    '',
    'Caller: ' + name,
    'Phone: ' + phone,
    'Address: ' + address,
    'Job: ' + service,
    'Details: ' + problem,
    'Best time to call back: ' + when,
    'Price information the caller was given: ' + priceInfo,
    'Requested: ' + called + ' (' + config.timeZone + ')',
    '',
    'The caller was told the office will call them back. No appointment has been booked.'
  ].join('\n');
  // Calendar entry: at the day/time the caller asked for, else at the next time the office is open.
  var tz = config.timeZone;
  var startMs = NaN;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(args.callback_date || '')) && /^\d{2}:\d{2}$/.test(String(args.callback_time || ''))) {
    startMs = localToUtcMs(args.callback_date, args.callback_time, tz);
  }
  var asap = isNaN(startMs) || startMs < nowMs;
  if (asap) {
    var next = allSlots(config, [], localDateStr(nowMs, tz), nowMs, 15)[0];
    startMs = next ? next.startMs : nowMs;
  }
  var endMs = startMs + 15 * 60000;
  var calendarWhen = friendlyLabel(startMs, tz);
  body += '\n\nOn the calendar as a callback for: ' + calendarWhen + (asap ? ' (next time the office is open)' : '');
  var eventDescription = [
    'CALLBACK REQUEST (not a job visit)',
    'Caller: ' + name,
    'Phone: ' + phone,
    'Address: ' + address,
    'Job: ' + service,
    'Details: ' + problem,
    'Wants to talk about: price / details before booking',
    'Price information given: ' + priceInfo,
    'Preferred time said by caller: ' + when
  ].join('\n');
  var to = config.callbackEmail || config.ownerEmail;
  return {
    to: to, subject: config.businessName + ': Callback requested - ' + service + ' - ' + name, body: body,
    calendarId: config.calendarId,
    eventStart: toLocalIso(startMs, tz), eventEnd: toLocalIso(endMs, tz), calendarWhen: calendarWhen,
    eventTitle: 'CALLBACK: ' + service + ' - ' + name, eventDescription: eventDescription
  };
}

if (typeof module !== 'undefined') module.exports = { buildCallbackEmail: buildCallbackEmail };
