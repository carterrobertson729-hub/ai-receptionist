// PASTE INTO n8n: workflow "Receptionist - Book Appointment" > node "Build Response" > Code tab (select all, replace, Save).
var v = $('Verify Slot').first().json;
var res;
if (v.status === 'open' || v.status === 'duplicate') {
  res = { booked: true, when: v.label, visitKind: v.visitKind, estimatedMinutes: v.durationMinutes, message: 'Booked for ' + v.label + (v.visitKind === 'estimate' ? ' as an on-site ESTIMATE visit; the technician gives an exact price after seeing the job' : '') + ' (estimated visit about ' + v.durationMinutes + ' minutes, an estimate only). Confirm this back to the caller. Say a confirmation text is on its way. Do not promise an exact arrival time.' };
} else if (v.status === 'taken') {
  res = { booked: false, reason: 'slot_taken', alternatives: v.alternatives, message: 'That time was just taken. Apologize briefly and offer these alternatives.' };
} else {
  res = { booked: false, reason: v.reason, message: 'Missing or invalid information (' + v.reason + '). Ask the caller for it again, then retry.' };
}
return [{ json: res }];
