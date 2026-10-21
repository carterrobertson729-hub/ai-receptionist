// Find, cancel and reschedule appointments, whether the AI booked them or staff typed them into the calendar.
// Needs slots.js helpers (busyFromEvents, allSlots, offerSlots, serviceFor, localDateStr, toLocalIso, friendlyLabel) inlined before it.
// Unit-tested by tools/test-appointments.mjs.

function apptDigits(s) { return String(s || '').replace(/\D/g, ''); }

function apptPhone(raw) {
  var d = apptDigits(raw);
  if (d.length === 10) d = '1' + d;
  return d.length === 11 && d.charAt(0) === '1' ? '+' + d : null;
}

// Pull "Label: value" out of an event description the booking workflow wrote.
function apptField(desc, label) {
  var lines = String(desc || '').split('\n');
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indexOf(label + ':') === 0) return lines[i].slice(label.length + 1).trim();
  }
  return '';
}

// Everything a person could have typed into the event that might identify the customer.
function apptText(e) {
  var attendees = (e.attendees || []).map(function (a) { return (a.displayName || '') + ' ' + (a.email || ''); }).join(' ');
  return [e.summary, e.description, e.location, attendees].join('\n').toLowerCase();
}

// Does the event text contain this phone number, written in any common format?
function apptHasPhone(text, phone) {
  var want = apptPhone(phone);
  if (!want) return false;
  var ten = apptDigits(want).slice(1);
  var found = String(text).match(/(?:\+?1[\s.\-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/g) || [];
  return found.some(function (m) { return apptDigits(m).slice(-10) === ten; });
}

function apptHasName(text, name) {
  var words = String(name || '').toLowerCase().split(/\s+/).filter(function (w) { return w.length > 1; });
  if (!words.length) return false;
  return words.every(function (w) { return String(text).indexOf(w) !== -1; });
}

// A real timed appointment: not cancelled, not a callback reminder, not an all-day or "free" calendar note.
function isAppointment(e) {
  if (!e || e.status === 'cancelled' || e.transparency === 'transparent') return false;
  if (!e.start || !e.start.dateTime || !e.end || !e.end.dateTime) return false;
  return String(e.summary || '').indexOf('CALLBACK:') !== 0;
}

// The caller must give the phone number AND a name that both appear on the event, so nobody can cancel a stranger's visit.
function apptOwnedBy(e, phone, name) {
  var text = apptText(e);
  return apptHasPhone(text, phone) && apptHasName(text, name);
}

// What the business's cancellation policy means for this appointment right now. The AI never charges anything;
// it only tells the caller the policy (when it applies, or when asked) and flags the office.
function cancellationInfo(config, startMs, visitType, nowMs) {
  var p = config.cancellationPolicy;
  if (!p || !p.feeAmount || p.freeUntilHoursBefore === undefined) return { policyOnFile: false, feeApplies: false };
  var hours = (startMs - nowMs) / 3600000;
  var late = hours < p.freeUntilHoursBefore;
  var exempt = visitType === 'estimate' && p.estimateVisitsExempt !== false;
  return {
    policyOnFile: true, hoursUntilVisit: Math.max(0, Math.round(hours * 10) / 10),
    freeUntilHoursBefore: p.freeUntilHoursBefore, feeApplies: late && !exempt, feeAmount: late && !exempt ? p.feeAmount : 0,
    rescheduleCountsAsCancel: !!p.rescheduleCountsAsCancel,
    announce: p.announce === 'only_if_asked' ? 'only_if_asked' : 'when_applies'
  };
}

function apptSummary(config, e, nowMs) {
  var tz = config.timeZone;
  var startMs = Date.parse(e.start.dateTime), endMs = Date.parse(e.end.dateTime);
  var visitText = apptField(e.description, 'Visit type');
  var summary = String(e.summary || '');
  var fromTitle = serviceFor(config, summary.replace(/^ESTIMATE VISIT:\s*/, ''));
  var service = apptField(e.description, 'Job type') || (fromTitle ? fromTitle.name : 'Other or not sure');
  var out = {
    eventId: e.id,
    title: summary,
    when: friendlyLabel(startMs, tz),
    start: toLocalIso(startMs, tz),
    end: toLocalIso(endMs, tz),
    minutes: Math.round((endMs - startMs) / 60000),
    service: service,
    visitType: /estimate/i.test(visitText) || /^ESTIMATE VISIT:/.test(summary) ? 'estimate' : (/FULL JOB/.test(visitText) ? 'job' : undefined),
    address: apptField(e.description, 'Address') || String(e.location || ''),
    problem: apptField(e.description, 'Problem') || summary,
    cancellation: null
  };
  out.cancellation = cancellationInfo(config, startMs, out.visitType, nowMs);
  return out;
}

// Upcoming appointments that belong to this caller.
function findAppointments(config, events, args, nowMs) {
  return (events || []).filter(function (e) {
    return isAppointment(e) && Date.parse(e.end.dateTime) > nowMs && apptOwnedBy(e, args.phone, args.name);
  }).sort(function (a, b) { return Date.parse(a.start.dateTime) - Date.parse(b.start.dateTime); })
    .map(function (e) { return apptSummary(config, e, nowMs); });
}

function locateOwned(events, args) {
  var ev = (events || []).filter(function (e) { return e && e.id === args.event_id; })[0];
  if (!ev || !isAppointment(ev)) return { status: 'not_found' };
  if (!apptOwnedBy(ev, args.phone, args.name)) return { status: 'not_verified' };
  return { status: 'ok', event: ev };
}

// Who to show in the office email: the name on the booking if it has one, else the name the caller gave.
function apptWho(e, args) { return apptField(e.description, 'Client') || apptField(e.description, 'Caller') || String(args.name || '').trim() || 'the caller'; }
function apptPhoneText(e, args) { return apptField(e.description, 'Phone') || (apptPhone(args.phone) || String(args.phone || '')); }

function checkCancel(config, events, args, nowMs) {
  var found = locateOwned(events, args);
  if (found.status !== 'ok') return found;
  var a = apptSummary(config, found.event, nowMs);
  var who = apptWho(found.event, args);
  var late = a.cancellation.feeApplies;
  var subject = config.businessName + ': Appointment CANCELLED' + (late ? ' (LATE - fee applies)' : '') + ' - ' + a.service + ' - ' + who;
  var lateLine = 'LATE CANCELLATION: cancelled about ' + a.cancellation.hoursUntilVisit + ' hours before the visit. Your policy says a $' + a.cancellation.feeAmount + ' fee applies. The AI did not charge anything and did not promise to waive it; please follow up.';
  var lines = ['APPOINTMENT CANCELLED BY THE CALLER', '', 'Caller: ' + who, 'Phone: ' + apptPhoneText(found.event, args),
    'Calendar entry: ' + a.title, 'Job: ' + a.service + (a.visitType === 'estimate' ? ' (estimate visit)' : ''), 'Was scheduled: ' + a.when + ' (about ' + a.minutes + ' minutes)',
    'Address: ' + a.address, 'Details: ' + a.problem, ''];
  if (late) lines.push(lateLine, '');
  lines.push('The time is open again on the calendar.');
  return { status: 'ok', eventId: found.event.id, appointment: a, cancellation: a.cancellation, to: config.ownerEmail, subject: subject, body: lines.join('\n') };
}

function checkReschedule(config, events, args, nowMs) {
  var found = locateOwned(events, args);
  if (found.status !== 'ok') return found;
  var tz = config.timeZone;
  var ev = found.event;
  var a = apptSummary(config, ev, nowMs);
  var changeFee = a.cancellation.feeApplies && a.cancellation.rescheduleCountsAsCancel;
  var newStart = Date.parse(args.new_start);
  if (isNaN(newStart)) return { status: 'invalid_start' };
  var others = events.filter(function (e) { return e !== ev; });
  var open = allSlots(config, busyFromEvents(others, tz), localDateStr(newStart, tz), nowMs, a.minutes)
    .some(function (s) { return s.startMs === newStart; });
  if (!open) {
    return { status: 'taken', alternatives: offerSlots(config, others, { preferred_date: localDateStr(newStart, tz), service: a.service, visit_type: a.visitType, minutes: a.minutes }, nowMs) };
  }
  var newEnd = newStart + a.minutes * 60000;
  var newWhen = friendlyLabel(newStart, tz);
  var who = apptWho(ev, args);
  var subject = config.businessName + ': Appointment RESCHEDULED - ' + a.service + ' - ' + who;
  var lines = ['APPOINTMENT RESCHEDULED BY THE CALLER', '', 'Caller: ' + who, 'Phone: ' + apptPhoneText(ev, args),
    'Calendar entry: ' + a.title, 'Job: ' + a.service + (a.visitType === 'estimate' ? ' (estimate visit)' : ''), 'Was: ' + a.when, 'Now: ' + newWhen + ' (about ' + a.minutes + ' minutes)',
    'Address: ' + a.address, 'Details: ' + a.problem];
  if (changeFee) lines.push('', 'LATE CHANGE: moved about ' + a.cancellation.hoursUntilVisit + ' hours before the visit. Your policy treats this like a late cancellation, so a $' + a.cancellation.feeAmount + ' fee applies. The AI did not charge anything; please follow up.');
  return {
    status: 'ok', eventId: ev.id, appointment: a, changeFeeApplies: changeFee, oldWhen: a.when, newWhen: newWhen,
    newStart: toLocalIso(newStart, tz), newEnd: toLocalIso(newEnd, tz),
    newDescription: String(ev.description || '') + '\nRescheduled by caller from: ' + a.when,
    to: config.ownerEmail, subject: subject, body: lines.join('\n')
  };
}

if (typeof module !== 'undefined') {
  module.exports = { findAppointments: findAppointments, checkCancel: checkCancel, checkReschedule: checkReschedule, isAppointment: isAppointment, apptOwnedBy: apptOwnedBy };
}
