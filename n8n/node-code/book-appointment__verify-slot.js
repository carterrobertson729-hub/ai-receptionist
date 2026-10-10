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
    if (String(e.summary || '').indexOf('CALLBACK:') === 0) return;   // callback reminders never block technicians
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

// For big jobs only: 'job' (book the whole job) or 'estimate' (short on-site visit). Jobs the business marks
// multiDay are never booked by the AI, so they always become an estimate visit. Ordinary jobs return undefined.
function effectiveVisitType(config, service, visitType) {
  var found = serviceFor(config, service);
  if (!(found && found.pricing && found.pricing.type === 'big_job')) return undefined;
  if (found.multiDay) return 'estimate';
  return visitType === 'job' ? 'job' : 'estimate';
}

// Visit length in minutes for a job type. Unknown or missing types get the safe default length.
// Big jobs have two lengths: the short on-site ESTIMATE visit (durationMinutes, the default) and the whole
// job (jobMinutes), used only when the caller books the job itself and it fits in one day.
function durationFor(config, service, visitType) {
  var found = serviceFor(config, service);
  if (effectiveVisitType(config, service, visitType) === 'job' && found.jobMinutes) return found.jobMinutes;
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

// Pick up to max offers spread across the first day that has openings: the earliest, a middle one, and a late one,
// preferring times on the hour, never closer together than spacing. If that day has fewer than max openings, the
// earliest openings of the following days fill the rest.
function spreadPick(slots, max, spacing, tz) {
  if (!slots.length) return [];
  var dayOf = function (s) { return toLocalIso(s.startMs, tz).slice(0, 10); };
  var day = dayOf(slots[0]);
  var sameDay = slots.filter(function (s) { return dayOf(s) === day; });
  var picked = [sameDay[0]];
  var far = function (s) { return picked.every(function (p) { return p !== s && Math.abs(s.startMs - p.startMs) >= spacing; }); };
  if (sameDay.length > 1 && max > 1) {
    var first = sameDay[0].startMs, last = sameDay[sameDay.length - 1].startMs;
    for (var i = 1; i < max; i++) {
      var target = first + (last - first) * i / (max - 1);
      var best = null, bestCost = Infinity;
      sameDay.forEach(function (s) {
        if (!far(s)) return;
        var cost = Math.abs(s.startMs - target) + (toLocalIso(s.startMs, tz).slice(14, 16) === '00' ? 0 : 45 * 60000);
        if (cost < bestCost) { best = s; bestCost = cost; }
      });
      if (best) picked.push(best);
    }
  }
  for (var j = 0; j < slots.length && picked.length < max; j++) {
    if (dayOf(slots[j]) !== day && far(slots[j])) picked.push(slots[j]);
  }
  return picked.sort(function (a, b) { return a.startMs - b.startMs; });
}

function offerSlots(config, events, args, nowMs) {
  var tz = config.timeZone;
  var slots = allSlots(config, busyFromEvents(events, tz), args.preferred_date, nowMs, durationFor(config, args.service, args.visit_type));
  if (args.part_of_day === 'morning' || args.part_of_day === 'afternoon') {
    var filtered = slots.filter(function (s) {
      var hour = +toLocalIso(s.startMs, tz).slice(11, 13);
      return args.part_of_day === 'morning' ? hour < 12 : hour >= 12;
    });
    if (filtered.length) slots = filtered;
  }
  // If the caller asked for a specific time, offer that exact time first when it is open,
  // then the nearest other openings. Otherwise offer the earliest openings.
  var wantMs = NaN;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(args.preferred_date || '')) && /^\d{2}:\d{2}$/.test(String(args.preferred_time || ''))) {
    wantMs = localToUtcMs(args.preferred_date, args.preferred_time, tz);
  }
  var spacing = (config.bookingRules.offerSpacingMinutes || 0) * 60000;   // avoid near-identical offers
  var max = config.bookingRules.maxSlotsOffered;
  var ordered;
  if (isNaN(wantMs)) {
    ordered = spreadPick(slots, max, spacing, tz);   // no specific time: spread across the day
  } else {
    // A specific time was asked for: that exact time first when open, then the nearest other openings.
    var picked = [];
    var exact = slots.filter(function (s) { return s.startMs === wantMs; })[0] || null;
    if (exact) picked.push(exact);
    var rest = slots.filter(function (s) { return s !== exact; });
    rest.sort(function (a, b) { return Math.abs(a.startMs - wantMs) - Math.abs(b.startMs - wantMs); });
    for (var i = 0; i < rest.length && picked.length < max; i++) {
      var farEnough = picked.every(function (p) { return Math.abs(rest[i].startMs - p.startMs) >= spacing; });
      if (farEnough) picked.push(rest[i]);
    }
    var others = picked.filter(function (s) { return s !== exact; }).sort(function (a, b) { return a.startMs - b.startMs; });
    ordered = exact ? [exact].concat(others) : others;
  }
  return ordered.map(function (s) { return describeSlot(s, tz); });
}

// Is the exact time the caller asked for open? If not, why not (so the agent can explain honestly).
function requestedTimeStatus(config, events, args, nowMs) {
  var tz = config.timeZone;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(args.preferred_date || '')) || !/^\d{2}:\d{2}$/.test(String(args.preferred_time || ''))) return null;
  var dur = durationFor(config, args.service, args.visit_type) * 60000;
  var startMs = localToUtcMs(args.preferred_date, args.preferred_time, tz);
  var status = { time: args.preferred_time, label: friendlyLabel(startMs, tz), visitMinutes: dur / 60000, available: false, reason: '' };
  var open = allSlots(config, busyFromEvents(events, tz), args.preferred_date, nowMs, dur / 60000);
  if (open.some(function (s) { return s.startMs === startMs; })) { status.available = true; return status; }
  var hours = config.hours[weekdayKey(args.preferred_date)];
  if (!hours) status.reason = 'the office takes no visits that day';
  else if (startMs < localToUtcMs(args.preferred_date, hours[0], tz) || startMs + dur > localToUtcMs(args.preferred_date, hours[1], tz)) status.reason = 'that time falls outside booking hours, or the visit would run past closing';
  else if (startMs < nowMs + config.bookingRules.minNoticeHours * 3600000) status.reason = 'that is too soon, the office needs about ' + config.bookingRules.minNoticeHours + ' hours notice';
  else status.reason = 'it overlaps another appointment or the travel time needed between jobs';
  return status;
}

// ---- Callback times: when the office can phone the caller back. Separate from technician availability. ----
// Technician jobs never matter here; only other callbacks already on the calendar (so two callers do not get the
// same minute). Office hours apply. 15 minute slots every 30 minutes, about 30 minutes notice.
function callbackConfig(config) {
  var r = config.bookingRules;
  return Object.assign({}, config, {
    services: [],
    bookingRules: Object.assign({}, r, {
      appointmentMinutes: 15, slotStepMinutes: 30, bufferMinutes: 0, offerSpacingMinutes: 60,
      minNoticeHours: (r.callbackMinNoticeMinutes || 30) / 60
    })
  });
}

function callbackOnly(events) {
  return (events || []).filter(function (e) { return e && e.status !== 'cancelled' && String(e.summary || '').indexOf('CALLBACK:') === 0; })
    .map(function (e) { return { start: e.start, end: e.end }; });
}

function offerCallbackSlots(config, events, args, nowMs) {
  return offerSlots(callbackConfig(config), callbackOnly(events),
    { preferred_date: args.preferred_date, part_of_day: args.part_of_day, preferred_time: args.preferred_time }, nowMs);
}

function requestedCallbackStatus(config, events, args, nowMs) {
  return requestedTimeStatus(callbackConfig(config), callbackOnly(events),
    { preferred_date: args.preferred_date, preferred_time: args.preferred_time }, nowMs);
}

// True only if startIso is exactly one of the business's open slots right now.
function isSlotStillOpen(config, events, startIso, nowMs, service, visitType) {
  var tz = config.timeZone;
  var startMs = Date.parse(startIso);
  if (isNaN(startMs)) return false;
  var slots = allSlots(config, busyFromEvents(events, tz), localDateStr(startMs, tz), nowMs, durationFor(config, service, visitType));
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
  else if (isSlotStillOpen(ctx.config, events, a.start, ctx.nowMs, a.service, a.visit_type)) out = { status: 'open' };
  else out = { status: 'taken', alternatives: offerSlots(ctx.config, events, { preferred_date: a.start.slice(0, 10), service: a.service, visit_type: a.visit_type }, ctx.nowMs) };
  var minutes = durationFor(ctx.config, a.service, a.visit_type);
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
var big = isBigJob(ctx.config, a.service);
var estimate = big && effectiveVisitType(ctx.config, a.service, a.visit_type) !== 'job';
out.visitKind = estimate ? 'estimate' : (big ? 'big_job' : 'service');
out.summary = (estimate ? 'ESTIMATE VISIT: ' : '') + out.service + ' - ' + name;
out.description = 'Booked by AI receptionist\nCaller: ' + name + '\nPhone: ' + phone + '\nAddress: ' + address +
  '\nProblem: ' + problem + '\nJob type: ' + out.service + '\nVisit type: ' + (estimate ? 'On-site estimate visit (big job: give an exact quote after seeing it)' : (big ? 'FULL JOB booked by the caller (exact price confirmed on site before work starts)' : 'Service visit')) + '\nSomeone on site: ' + (a.someone_on_site || 'not asked') +
  '\nLanguage: ' + (a.language || 'en') + '\nCall: ' + ctx.callId;
return [{ json: out }];
