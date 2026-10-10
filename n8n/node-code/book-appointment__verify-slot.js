// PASTE INTO n8n: workflow "Receptionist - Book Appointment" > node "Verify Slot" > Code tab (select all, replace, Save).
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


var ctx = $('Load Business Config').first().json;
var a = ctx.args;
var events = $input.all().map(function (i) { return i.json; });

function normalizePhone(raw) {
  var d = String(raw || '').replace(/\D/g, '');
  if (d.length === 10) d = '1' + d;
  return d.length === 11 && d.charAt(0) === '1' ? '+' + d : null;
}
var phone = normalizePhone(a.phone);
var name = String(a.name || '').trim();
var address = String(a.address || '').trim();
var problem = String(a.problem || '').trim();
var out = { status: 'invalid', reason: '' };
if (!name) out.reason = 'missing_name';
else if (!phone) out.reason = 'invalid_phone';
else if (!address) out.reason = 'missing_address';
else if (!problem) out.reason = 'missing_problem';
else if (isNaN(Date.parse(a.start))) out.reason = 'invalid_start';
else {
  var startMs = Date.parse(a.start);
  var tz = ctx.config.timeZone;
  var dup = events.some(function (e) {
    return e && e.start && e.start.dateTime && Date.parse(e.start.dateTime) === startMs &&
      String(e.description || '').indexOf(phone) !== -1;
  });
  if (dup) out = { status: 'duplicate' };
  else if (isSlotStillOpen(ctx.config, events, a.start, ctx.nowMs, a.service)) out = { status: 'open' };
  else out = { status: 'taken', alternatives: offerSlots(ctx.config, events, { preferred_date: a.start.slice(0, 10), service: a.service }, ctx.nowMs) };
  var minutes = durationFor(ctx.config, a.service);
  var endMs = startMs + minutes * 60000;
  out.durationMinutes = minutes;
  out.startIso = toLocalIso(startMs, tz);
  out.endIso = toLocalIso(endMs, tz);
  out.label = friendlyLabel(startMs, tz);
}
out.phone = phone;
out.name = name;
out.address = address;
out.problem = problem;
out.service = String(a.service || 'Service visit').trim();
var estimate = isBigJob(ctx.config, a.service);
out.visitKind = estimate ? 'estimate' : 'service';
out.summary = (estimate ? 'ESTIMATE VISIT: ' : '') + out.service + ' - ' + name;
out.description = 'Booked by AI receptionist\nCaller: ' + name + '\nPhone: ' + phone + '\nAddress: ' + address +
  '\nProblem: ' + problem + '\nVisit type: ' + (estimate ? 'On-site estimate visit (big job: give an exact quote after seeing it)' : 'Service visit') + '\nSomeone on site: ' + (a.someone_on_site || 'not asked') +
  '\nLanguage: ' + (a.language || 'en') + '\nCall: ' + ctx.callId;
return [{ json: out }];
