// PASTE INTO n8n: workflow "Receptionist - Urgent Alert" > node "Build Response" > Code tab (select all, replace, Save).
var sent = $('Build Alerts').all().map(function (i) { return i.json.name + ' (' + i.json.role + ')'; });
return [{ json: {
  alerted: true,
  notified: sent,
  message: 'The on-call technician and the owner have been alerted by email right now. Tell the caller that. Do not promise an arrival time or a call-back time.'
} }];
