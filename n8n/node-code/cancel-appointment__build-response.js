// PASTE INTO n8n: workflow "Receptionist - Cancel Appointment" > node "Build Response" > Code tab (select all, replace, Save).
var v = $('Verify Cancel').first().json;
var res;
if (v.status === 'ok') res = { cancelled: true, was: v.appointment.when, message: 'The appointment (' + v.appointment.service + ', ' + v.appointment.when + ') is cancelled and the office has been told. Confirm that to the caller and ask if they would like to book a new time.' };
else if (v.status === 'not_verified' || v.status === 'not_found') res = { cancelled: false, reason: v.status, message: 'Could not cancel: that appointment was not found for this name and phone number. Do not guess. Ask them to repeat the name and number, or offer to take a message.' };
else res = { cancelled: false, reason: v.status, message: 'Could not cancel (' + v.status + '). Apologize, and offer to take a message for the office.' };
return [{ json: res }];
