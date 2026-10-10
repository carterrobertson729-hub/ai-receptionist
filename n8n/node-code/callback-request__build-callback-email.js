// PASTE INTO n8n: workflow "Receptionist - Callback Request" > node "Build Callback Email" > Code tab (select all, replace, Save).
// Shared scheduling logic. Inlined into n8n Code nodes by tools/build-workflows.mjs
// and unit-tested by tools/test-slots.mjs. No dependencies; time zones via Intl.

var DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// Minutes the zone is ahead of UTC at the given instant.
function zoneOffsetMinutes(utcMs, tz) {
  var parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).formatToParts(new Date(utcMs));
  var p = {};
  parts.forEach(function (x) { p[x.type] = x.value; });
  var asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 60000);
}

// Wall-clock time in the zone ("2026-10-13", "08:00") -> UTC ms.
function localToUtcMs(dateStr, hhmm, tz) {
  var d = dateStr.split('-').map(Number);
  var t = hhmm.split(':').map(Number);
  var guess = Date.UTC(d[0], d[1] - 1, d[2], t[0], t[1], 0);
  var utc = guess - zoneOffsetMinutes(guess, tz) * 60000;
  var off2 = zoneOffsetMinutes(utc, tz);
  return guess - off2 * 60000;
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }

// UTC ms -> "2026-10-13T08:00:00-04:00" in the zone.
function toLocalIso(utcMs, tz) {
  var off = zoneOffsetMinutes(utcMs, tz);
  var local = new Date(utcMs + off * 60000);
  var sign = off < 0 ? '-' : '+';
  var a = Math.abs(off);
  return local.getUTCFullYear() + '-' + pad2(local.getUTCMonth() + 1) + '-' + pad2(local.getUTCDate()) +
    'T' + pad2(local.getUTCHours()) + ':' + pad2(local.getUTCMinutes()) + ':' + pad2(local.getUTCSeconds()) +
    sign + pad2(Math.floor(a / 60)) + ':' + pad2(a % 60);
}

function localDateStr(utcMs, tz) {
  return toLocalIso(utcMs, tz).slice(0, 10);
}

function addDays(dateStr, n) {
  var d = dateStr.split('-').map(Number);
  var t = new Date(Date.UTC(d[0], d[1] - 1, d[2] + n));
  return t.getUTCFullYear() + '-' + pad2(t.getUTCMonth() + 1) + '-' + pad2(t.getUTCDate());
}

function weekdayKey(dateStr) {
  var d = dateStr.split('-').map(Number);
  return DAY_KEYS[new Date(Date.UTC(d[0], d[1] - 1, d[2])).getUTCDay()];
}

function friendlyLabel(utcMs, tz) {
  var day = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(utcMs));
  var time = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(utcMs));
  return day + ' at ' + time;
}

// Google Calendar events -> [{start, end}] in UTC ms. Skips cancelled and "free" events.
function busyFromEvents(events, tz) {
  var out = [];
  (events || []).forEach(function (e) {
    if (!e || e.status === 'cancelled' || e.transparency === 'transparent') return;
    var s = e.start || {};
    var en = e.end || {};
    if (s.dateTime && en.dateTime) {
      out.push({ start: Date.parse(s.dateTime), end: Date.parse(en.dateTime) });
    } else if (s.date && en.date) {
      out.push({ start: localToUtcMs(s.date, '00:00', tz), end: localToUtcMs(en.date, '00:00', tz) });
    }
  });
  return out;
}

// The business's service entry for a job type: exact name first, then partial match.
function serviceFor(config, service) {
  var name = String(service || '').trim().toLowerCase();
  if (!name || !config.services) return null;
  return config.services.filter(function (x) { return String(x.name).toLowerCase() === name; })[0] ||
    config.services.filter(function (x) { var n = String(x.name).toLowerCase(); return n.indexOf(name) !== -1 || name.indexOf(n) !== -1; })[0] || null;
}

// Visit length in minutes for a job type. Unknown or missing types get the safe default length.
// For big jobs this is the length of the on-site ESTIMATE visit, not of the whole job.
function durationFor(config, service) {
  var found = serviceFor(config, service);
  return found && found.durationMinutes ? found.durationMinutes : config.bookingRules.appointmentMinutes;
}

function isBigJob(config, service) {
  var found = serviceFor(config, service);
  return !!(found && found.pricing && found.pricing.type === 'big_job');
}

// All bookable slots in the window, earliest first. No cap; callers cap.
// durationMin is the visit length for this job type (defaults to the business default).
function allSlots(config, busy, fromDate, nowMs, durationMin) {
  var rules = config.bookingRules;
  var tz = config.timeZone;
  var dur = (durationMin || rules.appointmentMinutes) * 60000;
  var step = rules.slotStepMinutes * 60000;
  var buf = (rules.bufferMinutes || 0) * 60000;
  var earliest = nowMs + rules.minNoticeHours * 3600000;
  var today = localDateStr(nowMs, tz);
  var startDate = fromDate && fromDate > today ? fromDate : today;
  var slots = [];
  for (var i = 0; i < rules.maxDaysAhead; i++) {
    var date = addDays(startDate, i);
    var hours = config.hours[weekdayKey(date)];
    if (!hours) continue;
    var open = localToUtcMs(date, hours[0], tz);
    var close = localToUtcMs(date, hours[1], tz);
    for (var s = open; s + dur <= close; s += step) {
      if (s < earliest) continue;
      var clash = busy.some(function (b) { return s < b.end + buf && s + dur > b.start - buf; });
      if (clash) continue;
      slots.push({ startMs: s, endMs: s + dur });
    }
  }
  return slots;
}

function describeSlot(slot, tz) {
  return {
    start: toLocalIso(slot.startMs, tz),
    end: toLocalIso(slot.endMs, tz),
    minutes: Math.round((slot.endMs - slot.startMs) / 60000),
    label: friendlyLabel(slot.startMs, tz)
  };
}

function offerSlots(config, events, args, nowMs) {
  var tz = config.timeZone;
  var slots = allSlots(config, busyFromEvents(events, tz), args.preferred_date, nowMs, durationFor(config, args.service));
  if (args.part_of_day === 'morning' || args.part_of_day === 'afternoon') {
    var filtered = slots.filter(function (s) {
      var hour = +toLocalIso(s.startMs, tz).slice(11, 13);
      return args.part_of_day === 'morning' ? hour < 12 : hour >= 12;
    });
    if (filtered.length) slots = filtered;
  }
  // Spread the offers so we don't read out near-identical times (e.g. 12:30, 1:00, 1:30).
  var spacing = (config.bookingRules.offerSpacingMinutes || 0) * 60000;
  var picked = [];
  for (var i = 0; i < slots.length && picked.length < config.bookingRules.maxSlotsOffered; i++) {
    if (!picked.length || slots[i].startMs >= picked[picked.length - 1].startMs + spacing) picked.push(slots[i]);
  }
  return picked.map(function (s) { return describeSlot(s, tz); });
}

// True only if startIso is exactly one of the business's open slots right now.
function isSlotStillOpen(config, events, startIso, nowMs, service) {
  var tz = config.timeZone;
  var startMs = Date.parse(startIso);
  if (isNaN(startMs)) return false;
  var slots = allSlots(config, busyFromEvents(events, tz), localDateStr(startMs, tz), nowMs, durationFor(config, service));
  return slots.some(function (s) { return s.startMs === startMs; });
}


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


var item = $input.first().json;
var args = (item.body && item.body.args) || {};
var CONFIGS = {"demo-plumbing":{"businessId":"demo-plumbing","businessName":"Demo Plumbing Co","trade":"plumbing","timeZone":"America/Chicago","receptionistNumber":"REPLACE_WITH_RETELL_NUMBER_E164","smsFromNumber":"REPLACE_WITH_TWILIO_NUMBER_E164","ownerPhone":"REPLACE_WITH_OWNER_NUMBER_E164","ownerEmail":"carter.robertson729@gmail.com","people":{"carter":{"name":"Carter","email":"carter.robertson729@gmail.com","phone":"REPLACE_WITH_ONCALL_NUMBER_E164"}},"onCallSchedule":{"mon":"carter","tue":"carter","wed":"carter","thu":"carter","fri":"carter","sat":"carter","sun":"carter"},"calendarId":"d8f2a8fbc0b04e3460f2971b0c7d82d953936566b3e9f560190bc3317cf2367c@group.calendar.google.com","bookingRules":{"appointmentMinutes":120,"slotStepMinutes":30,"bufferMinutes":30,"minNoticeHours":2,"maxDaysAhead":14,"maxSlotsOffered":3,"offerSpacingMinutes":60},"hours":{"mon":["08:00","17:00"],"tue":["08:00","17:00"],"wed":["08:00","17:00"],"thu":["08:00","17:00"],"fri":["08:00","17:00"],"sat":["08:00","17:00"],"sun":["08:00","17:00"]},"services":[{"name":"Clogged toilet","durationMinutes":30,"emergency":false,"pricing":{"type":"flat","amount":50,"details":"standard clog"}},{"name":"Drain cleaning","durationMinutes":60,"emergency":false,"pricing":{"type":"flat","amount":120,"details":"one standard drain"}},{"name":"Leak repair","durationMinutes":60,"emergency":false,"pricing":{"type":"quote_on_site"}},{"name":"Faucet or fixture repair","durationMinutes":60,"emergency":false,"pricing":{"type":"quote_on_site"}},{"name":"Toilet repair or replacement","durationMinutes":90,"emergency":false,"pricing":{"type":"quote_on_site"}},{"name":"Water heater repair","durationMinutes":90,"emergency":false,"pricing":{"type":"quote_on_site"}},{"name":"Water heater replacement","durationMinutes":60,"jobMinutes":180,"emergency":false,"pricing":{"type":"big_job","startingAt":1200,"typical":"$1,800 to $3,200","estimateVisit":"a free on-site estimate visit"}},{"name":"Sewer line repair or replacement","durationMinutes":60,"jobMinutes":480,"emergency":false,"pricing":{"type":"big_job","startingAt":2500,"typical":"$4,000 to $12,000","estimateVisit":"a free on-site estimate visit"}},{"name":"Whole-house repipe","durationMinutes":60,"jobMinutes":480,"emergency":false,"pricing":{"type":"big_job","startingAt":4000,"typical":"$6,000 to $15,000","estimateVisit":"a free on-site estimate visit"}},{"name":"Other or not sure","durationMinutes":120,"emergency":false,"pricing":{"type":"quote_on_site"}},{"name":"Burst pipe or active flooding","emergency":true},{"name":"No water or sewage backup","emergency":true}],"fixedPrices":[],"neverSay":["Never quote a price that is not in the price list, and never estimate, round, or give a range.","Never promise an exact arrival time; offer only the booked window.","Never diagnose the problem or tell the caller how to repair it."],"languages":["en","es"],"notifications":{"emailOutcomes":["booked","message","urgent"],"skipOutcomes":["callback"]},"serviceCallFee":65}};
var config = CONFIGS[(item.query && item.query.business) || ''];
if (!config) throw new Error('Unknown business. Add ?business=<businessId> to the tool URL.');
var e = buildCallbackEmail(config, args, Date.now());
return [{ json: e }];
