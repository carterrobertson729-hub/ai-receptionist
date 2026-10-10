// PASTE INTO n8n: workflow "Receptionist - Reschedule Appointment" > node "Build Response" > Code tab (select all, replace, Save).
var v = $('Verify Reschedule').first().json;
var res;
if (v.status === 'ok') res = { rescheduled: true, was: v.oldWhen, now: v.newWhen, message: 'Moved from ' + v.oldWhen + ' to ' + v.newWhen + ', and the office has been told. Confirm the new time to the caller.' };
else if (v.status === 'taken') res = { rescheduled: false, reason: 'slot_taken', alternatives: v.alternatives, message: 'That new time is not available. Apologize briefly and offer these alternatives. Their original appointment is unchanged.' };
else if (v.status === 'not_verified' || v.status === 'not_found') res = { rescheduled: false, reason: v.status, message: 'Could not find that appointment for this name and phone number. Do not guess. Ask them to repeat the name and number, or offer to take a message.' };
else res = { rescheduled: false, reason: v.status, message: 'Could not reschedule (' + v.status + '). Their original appointment is unchanged. Apologize and offer to take a message.' };
return [{ json: res }];
