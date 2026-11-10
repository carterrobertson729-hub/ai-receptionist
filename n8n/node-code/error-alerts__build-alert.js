// PASTE INTO n8n: workflow "Receptionist - Error Alerts" > node "Build Alert" > Code tab (select all, replace, Save).
// Failure alert: turns n8n's Error Trigger data into one plain email to the owner. Unit-tested by tools/test-errormail.mjs.
function errorEmail(item, opts) {
  var e = (item && item.execution) || {}, w = (item && item.workflow) || {};
  var wname = String(w.name || 'Unknown workflow');
  if (opts && opts.ignoreName && wname.indexOf(opts.ignoreName) !== -1) return { ok: false, reason: 'self' };   // never alert about the alert workflow itself
  var err = e.error || {};
  var msg = String(err.message || err.description || 'No message').slice(0, 500);
  var node = e.lastNodeExecuted || err.node && err.node.name || 'unknown step';
  return { ok: true, to: opts.ownerEmail, subject: 'n8n FAILED: ' + wname + ' (' + node + ')',
    body: 'A workflow stopped with an error.\n\nWorkflow: ' + wname + '\nStep that failed: ' + node + '\nWhat it said: ' + msg +
      (e.id ? '\nExecution: ' + (e.url || ('id ' + e.id)) : '') +
      '\n\nWhat to do: open the link, look at the red step, and paste the message to Claude if you are not sure. If this is a customer-facing workflow (booking, cancel, summary), check that customers are not affected.' };
}

var SETTINGS = { ownerEmail: 'carter.robertson729@gmail.com', ignoreName: 'Error Alerts' };
var r = errorEmail($input.first().json, SETTINGS);
return r.ok ? [{ json: r }] : [];
