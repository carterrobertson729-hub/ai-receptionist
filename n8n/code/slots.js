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

// All bookable slots in the window, earliest first. No cap; callers cap.
function allSlots(config, busy, fromDate, nowMs) {
  var rules = config.bookingRules;
  var tz = config.timeZone;
  var dur = rules.appointmentMinutes * 60000;
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
    label: friendlyLabel(slot.startMs, tz)
  };
}

function offerSlots(config, events, args, nowMs) {
  var tz = config.timeZone;
  var slots = allSlots(config, busyFromEvents(events, tz), args.preferred_date, nowMs);
  if (args.part_of_day === 'morning' || args.part_of_day === 'afternoon') {
    var filtered = slots.filter(function (s) {
      var hour = +toLocalIso(s.startMs, tz).slice(11, 13);
      return args.part_of_day === 'morning' ? hour < 12 : hour >= 12;
    });
    if (filtered.length) slots = filtered;
  }
  return slots.slice(0, config.bookingRules.maxSlotsOffered).map(function (s) { return describeSlot(s, tz); });
}

// True only if startIso is exactly one of the business's open slots right now.
function isSlotStillOpen(config, events, startIso, nowMs) {
  var tz = config.timeZone;
  var startMs = Date.parse(startIso);
  if (isNaN(startMs)) return false;
  var slots = allSlots(config, busyFromEvents(events, tz), localDateStr(startMs, tz), nowMs);
  return slots.some(function (s) { return s.startMs === startMs; });
}

if (typeof module !== 'undefined') {
  module.exports = {
    zoneOffsetMinutes: zoneOffsetMinutes, localToUtcMs: localToUtcMs, toLocalIso: toLocalIso,
    offerSlots: offerSlots, isSlotStillOpen: isSlotStillOpen, busyFromEvents: busyFromEvents,
    allSlots: allSlots, describeSlot: describeSlot
  };
}
