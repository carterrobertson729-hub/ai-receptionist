// PASTE INTO n8n: workflow "Receptionist - Book Appointment" > node "Build Response" > Code tab (select all, replace, Save).
var v = $('Verify Slot').first().json;
var res;
if (v.status === 'open' || v.status === 'duplicate') {
  var cfg = $('Load Business Config').first().json.config;
  var textNote = cfg.smsEnabled === true ? 'Say a confirmation text is on its way.' : 'Do not say a text is coming; say it is on the calendar.';
  if (cfg.collectAddress === false) {
    res = { booked: true, when: v.label, estimatedMinutes: v.durationMinutes, message: 'Booked for ' + v.label + ' (about ' + v.durationMinutes + ' minutes). Confirm this back to the caller and tell them to arrive a few minutes early. ' + textNote + (v.usedCallerId ? ' The phone number you gave could not be used, so the booking is under the number they are calling from (ending in ' + v.phone.slice(-4) + '). Tell the caller that, and offer to change it.' : '') };
  } else {
    res = { booked: true, when: v.label, visitKind: v.visitKind, estimatedMinutes: v.durationMinutes, message: 'Booked for ' + v.label + (v.visitKind === 'estimate' ? ' as an on-site ESTIMATE visit; the technician gives an exact price after seeing the job' : (v.visitKind === 'big_job' ? ' as the full job; the technician confirms the exact price on site before any work starts' : '')) + ' (estimated visit about ' + v.durationMinutes + ' minutes, an estimate only). Confirm this back to the caller. ' + textNote + ' Do not promise an exact arrival time.' };
  }
} else if (v.status === 'taken') {
  res = { booked: false, reason: 'slot_taken', alternatives: v.alternatives, message: 'That time was just taken. Apologize briefly and offer these alternatives.' };
} else {
  res = { booked: false, reason: v.reason, message: 'Missing or invalid information (' + v.reason + '). Ask the caller for it again, then retry.' };
}
return [{ json: res }];
