// PASTE INTO n8n: workflow "Receptionist - Weekly Owner Report" > node "Build Report" > Code tab (select all, replace, Save).
// Builds the weekly owner report email from the call log rows (the Calls tab). Inlined into the n8n Code node by
// tools/build-workflows.mjs; unit-tested by tools/test-report.mjs.

var REPORT_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function reportToday(nowMs, tz) {
  var parts = {};
  new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(nowMs)).forEach(function (p) { parts[p.type] = p.value; });
  return parts.year + '-' + parts.month + '-' + parts.day;
}

function reportAddDays(str, n) {
  var p = str.split('-');
  var d = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + n));
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}

// Sheets may hand back 2026-10-09 or 10/9/2026; both become 2026-10-09.
function reportDate(v) {
  var s = String(v === undefined || v === null ? '' : v).trim();
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return m[3] + '-' + ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2);
  return '';
}

function reportLabel(str) { var p = str.split('-'); return REPORT_MONTHS[Number(p[1]) - 1].slice(0, 3) + ' ' + Number(p[2]); }
function reportRound(n) { return Math.round(n * 10) / 10; }

function reportStats(rows) {
  var s = { calls: 0, business: 0, after: 0, minutes: 0, outcomes: {}, afterOutcomes: {}, days: {}, requests: {} };
  rows.forEach(function (r) {
    s.calls++;
    var after = String(r.Hours) === 'After hours';
    if (after) s.after++; else if (String(r.Hours) === 'Business hours') s.business++;
    s.minutes += Number(r.Minutes) || 0;
    var o = String(r.Outcome || 'other').toLowerCase().trim() || 'other';
    s.outcomes[o] = (s.outcomes[o] || 0) + 1;
    if (after) s.afterOutcomes[o] = (s.afterOutcomes[o] || 0) + 1;
    if (r.Day) s.days[r.Day] = (s.days[r.Day] || 0) + 1;
    var p = String(r.Problem || '').trim();
    if (p) s.requests[p] = (s.requests[p] || 0) + 1;
  });
  s.booked = (s.outcomes.booked || 0) + (s.outcomes.estimate || 0);
  s.afterBooked = (s.afterOutcomes.booked || 0) + (s.afterOutcomes.estimate || 0);
  return s;
}

function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

function buildWeeklyReport(config, rows, nowMs) {
  var tz = config.timeZone;
  var today = reportToday(nowMs, tz);
  var end = reportAddDays(today, -1), start = reportAddDays(end, -6);
  var prevEnd = reportAddDays(start, -1), prevStart = reportAddDays(prevEnd, -6);
  var clean = (rows || []).filter(function (r) { return r && reportDate(r.Date); });
  function inRange(a, b) { return clean.filter(function (r) { var d = reportDate(r.Date); return d >= a && d <= b; }); }
  var week = reportStats(inRange(start, end));
  var prev = reportStats(inRange(prevStart, prevEnd));
  var monthKey = end.slice(0, 7);
  var monthMinutes = reportRound(reportStats(clean.filter(function (r) { var d = reportDate(r.Date); return d.slice(0, 7) === monthKey && d <= end; })).minutes);

  var range = reportLabel(start) + ' - ' + reportLabel(end);
  var lines = [config.businessName + ' - your week with the AI receptionist', range, ''];

  if (week.calls === 0) {
    lines.push('No calls reached the AI receptionist this week.', '',
      'If you expected calls, check that call forwarding to the receptionist is still turned on. Reply to this email and we will help.');
  } else {
    lines.push('CALLS', '  ' + plural(week.calls, 'call', 'calls') + ' answered');
    lines.push('  ' + week.business + ' during business hours, ' + week.after + ' after hours');
    if (prev.calls > 0) {
      var diff = week.calls - prev.calls;
      lines.push('  ' + (diff === 0 ? 'Same as' : (diff > 0 ? 'Up ' + diff + ' from' : 'Down ' + Math.abs(diff) + ' from')) + ' last week (' + prev.calls + ')');
    }
    lines.push('', 'WHAT HAPPENED');
    lines.push('  ' + plural(week.booked, 'appointment booked', 'appointments booked'));
    var labels = [['message', 'message taken'], ['callback', 'callback requested'], ['cancelled', 'cancelled'], ['rescheduled', 'rescheduled'], ['info', 'price or hours question only'], ['urgent', 'urgent']];
    labels.forEach(function (l) { if (week.outcomes[l[0]]) lines.push('  ' + week.outcomes[l[0]] + ' ' + l[1]); });
    var rest = week.calls - week.booked - labels.reduce(function (t, l) { return t + (week.outcomes[l[0]] || 0); }, 0);
    if (rest > 0) lines.push('  ' + rest + ' hang-up or nothing needed');
    if (week.after > 0) {
      lines.push('', 'AFTER HOURS', '  ' + plural(week.after, 'call', 'calls') + ' came in when the shop was closed, and ' + week.afterBooked + ' turned into a booking.',
        '  These are customers who would otherwise have reached voicemail.');
    }
    var top = Object.keys(week.requests).sort(function (a, b) { return week.requests[b] - week.requests[a]; }).slice(0, 3);
    if (top.length) lines.push('', 'MOST REQUESTED', '  ' + top.map(function (k) { return k + ' (' + week.requests[k] + ')'; }).join(', '));
    var busiest = Object.keys(week.days).sort(function (a, b) { return week.days[b] - week.days[a]; })[0];
    if (busiest) lines.push('', 'BUSIEST DAY', '  ' + busiest + ' (' + week.days[busiest] + ' calls)');
    if (config.averageTicket && week.booked > 0) lines.push('', 'ROUGH VALUE', '  ' + week.booked + ' bookings at about $' + config.averageTicket + ' each is roughly $' + Math.round(week.booked * config.averageTicket) + ' of business.');
  }

  lines.push('', 'MINUTES', '  ' + reportRound(week.minutes) + ' minutes of calls this week');
  var plan = config.plan;
  if (plan && plan.includedMinutes) {
    lines.push('  ' + monthMinutes + ' of ' + plan.includedMinutes + ' included minutes used so far in ' + REPORT_MONTHS[Number(monthKey.slice(5)) - 1] + ' (' + Math.round(monthMinutes / plan.includedMinutes * 100) + '%)');
  }
  lines.push('', 'Questions, or want something changed? Just reply to this email.');

  return { to: config.reportEmail || config.ownerEmail, copyTo: (config.usageAlertEmail && config.usageAlertEmail !== (config.reportEmail || config.ownerEmail)) ? config.usageAlertEmail : '',
    subject: config.businessName + ': your week with the AI receptionist (' + range + ')', body: lines.join('\n'), stats: week };
}


// One business per loop. The call log rows come from "Get Call Rows"; the settings from "Loop Over Businesses".
var cfg = $('Loop Over Businesses').first().json.config;
var rows = $input.all().map(function (i) { return i.json; });
var r = buildWeeklyReport(cfg, rows, Date.now());
var out = [{ json: { send: true, to: r.to, subject: r.subject, body: r.body } }];
if (r.copyTo) out.push({ json: { send: true, to: r.copyTo, subject: '[Copy] ' + r.subject, body: r.body } });
return out;
