// Find, cancel and reschedule appointments that this system booked.
// Needs slots.js helpers (busyFromEvents, allSlots, offerSlots, localDateStr, toLocalIso, friendlyLabel) inlined before it.
// Unit-tested by tools/test-appointments.mjs.

function apptDigits(s) { return String(s || '').replace(/\D/g, ''); }

function apptPhone(raw) {
  var d = apptDigits(raw);
  if (d.length === 10) d = '1' + d;
  return d.length === 11 && d.charAt(0) === '1' ? '+' + d : null;
}

// Pull "Label: value" out of the event description the booking workflow wrote.
function apptField(desc, label) {
  var lines = String(desc || '').split('\n');
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indexOf(label + ':') === 0) return lines[i].slice(label.length + 1).trim();
  }
  return '';
}

// Only real appointments this system booked: not callback reminders, not cancelled, not events someone typed in by hand.
function isAppointment(e) {
  if (!e || e.status === 'cancelled' || !e.start || !e.start.dateTime || !e.end || !e.end.dateTime) return false;
  if (String(e.summary || '').indexOf('CALLBACK:') === 0) return false;
  return String(e.description || '').indexOf('Booked by AI receptionist') !== -1;
}

// The caller must give the phone number AND a name that matches the booking, so nobody can cancel a stranger's visit.
function apptOwnedBy(e, phone, name) {
  var want = apptPhone(phone);
  if (!want || apptDigits(apptField(e.description, 'Phone')) !== apptDigits(want)) return false;
  var words = String(name || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  var booked = apptField(e.description, 'Caller').toLowerCase();
  return words.every(function (w) { return booked.indexOf(w) !== -1; });
}

// What the business's cancellation policy means for this appointment right now. The AI never charges anything;
// it only warns the caller and tells the office.
function cancellationInfo(config, startMs, visitType, nowMs) {
  var p = config.cancellationPolicy;
  if (!p || !p.feeAmount || p.freeUntilHoursBefore === undefined) return { policyOnFile: false, feeMayApply: false };
  var hours = (startMs - nowMs) / 3600000;
  var late = hours < p.freeUntilHoursBefore;
  var exempt = visitType === 'estimate' && p.estimateVisitsExempt !== false;
  return {
    policyOnFile: true, hoursUntilVisit: Math.max(0, Math.round(hours * 10) / 10),
    freeUntilHoursBefore: p.freeUntilHoursBefore, feeMayApply: late && !exempt, feeAmount: late && !exempt ? p.feeAmount : 0,
    rescheduleCountsAsCancel: !!p.rescheduleCountsAsCancel
  };
}

function apptSummary(config, e, nowMs) {
  var tz = config.timeZone;
  var startMs = Date.parse(e.start.dateTime), endMs = Date.parse(e.end.dateTime);
  var visitText = apptField(e.description, 'Visit type');
  var summary = String(e.summary || '');
  var service = apptField(e.description, 'Job type') || summary.replace(/^ESTIMATE VISIT:\s*/, '').replace(/\s+-\s+[^-]*$/, '');
  var out = {
    eventId: e.id,
    when: friendlyLabel(startMs, tz),
    start: toLocalIso(startMs, tz),
    end: toLocalIso(endMs, tz),
    minutes: Math.round((endMs - startMs) / 60000),
    service: service,
    visitType: /estimate/i.test(visitText) || /^ESTIMATE VISIT:/.test(summary) ? 'estimate' : (/FULL JOB/.test(visitText) ? 'job' : undefined),
    address: apptField(e.description, 'Address'),
    problem: apptField(e.description, 'Problem'),
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

function checkCancel(config, events, args, nowMs) {
  var found = locateOwned(events, args);
  if (found.status !== 'ok') return found;
  var a = apptSummary(config, found.event, nowMs);
  var who = apptField(found.event.description, 'Caller');
  var late = a.cancellation.feeMayApply;
  var subject = config.businessName + ': Appointment CANCELLED' + (late ? ' (LATE - fee may apply)' : '') + ' - ' + a.service + ' - ' + who;
  var lateLine = 'LATE CANCELLATION: cancelled about ' + a.cancellation.hoursUntilVisit + ' hours before the visit. Your policy says a $' + a.cancellation.feeAmount + ' fee may apply. The AI did not charge anything and did not promise to waive it; please follow up.';
  var lines = ['APPOINTMENT CANCELLED BY THE CALLER', '', 'Caller: ' + who, 'Phone: ' + apptField(found.event.description, 'Phone'),
    'Job: ' + a.service + (a.visitType === 'estimate' ? ' (estimate visit)' : ''), 'Was scheduled: ' + a.when + ' (about ' + a.minutes + ' minutes)',
    'Address: ' + a.address, 'Problem: ' + a.problem, ''];
  if (late) lines.push(lateLine, '');
  lines.push('The time is open again on the calendar.');
  var body = lines.join('\n');
  return { status: 'ok', eventId: found.event.id, appointment: a, cancellation: a.cancellation, to: config.ownerEmail, subject: subject, body: body };
}

function checkReschedule(config, events, args, nowMs) {
  var found = locateOwned(events, args);
  if (found.status !== 'ok') return found;
  var tz = config.timeZone;
  var ev = found.event;
  var a = apptSummary(config, ev, nowMs);
  var changeFee = a.cancellation.feeMayApply && a.cancellation.rescheduleCountsAsCancel;
  var newStart = Date.parse(args.new_start);
  if (isNaN(newStart)) return { status: 'invalid_start' };
  var others = events.filter(function (e) { return e !== ev; });
  var open = allSlots(config, busyFromEvents(others, tz), localDateStr(newStart, tz), nowMs, a.minutes)
    .some(function (s) { return s.startMs === newStart; });
  if (!open) {
    return { status: 'taken', alternatives: offerSlots(config, others, { preferred_date: localDateStr(newStart, tz), service: a.service, visit_type: a.visitType }, nowMs) };
  }
  var newEnd = newStart + a.minutes * 60000;
  var newWhen = friendlyLabel(newStart, tz);
  var who = apptField(ev.description, 'Caller');
  var subject = config.businessName + ': Appointment RESCHEDULED - ' + a.service + ' - ' + who;
  var body = ['APPOINTMENT RESCHEDULED BY THE CALLER', '', 'Caller: ' + who, 'Phone: ' + apptField(ev.description, 'Phone'),
    'Job: ' + a.service + (a.visitType === 'estimate' ? ' (estimate visit)' : ''), 'Was: ' + a.when, 'Now: ' + newWhen + ' (about ' + a.minutes + ' minutes)',
    'Address: ' + a.address, 'Problem: ' + a.problem,
    changeFee ? '' : null, changeFee ? 'LATE CHANGE: moved about ' + a.cancellation.hoursUntilVisit + ' hours before the visit. Your policy treats this like a late cancellation, so a $' + a.cancellation.feeAmount + ' fee may apply. The AI did not charge anything; please follow up.' : null]
    .filter(function (l) { return l !== null; }).join('\n');
  return {
    status: 'ok', eventId: ev.id, appointment: a, changeFeeMayApply: changeFee, oldWhen: a.when, newWhen: newWhen,
    newStart: toLocalIso(newStart, tz), newEnd: toLocalIso(newEnd, tz),
    newDescription: String(ev.description || '') + '\nRescheduled by caller from: ' + a.when,
    to: config.ownerEmail, subject: subject, body: body
  };
}

if (typeof module !== 'undefined') {
  module.exports = { findAppointments: findAppointments, checkCancel: checkCancel, checkReschedule: checkReschedule, isAppointment: isAppointment, apptOwnedBy: apptOwnedBy };
}
