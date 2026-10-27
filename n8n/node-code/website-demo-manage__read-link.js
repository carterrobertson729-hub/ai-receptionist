// PASTE INTO n8n: workflow "Website - Demo Manage" > node "Read Link" > Code tab (select all, replace, Save).
var SETTINGS = {
  tz: 'America/Chicago', tzLabel: 'Central Time',
  calendarId: 'd4e067809ac408fb853c1d9eee25b3264d00f060d29aa3f3ca88cd5a428d344e@group.calendar.google.com',   // same calendar as the booking workflow
  ownerEmail: 'carter.robertson729@gmail.com',
  daysAhead: 46
};
var q = ($input.first().json.query) || {};
var id = String(q.e || '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 100);
return [{ json: { id: id || 'none', action: q['do'] === 'cancel' ? 'cancel' : 'lookup', calendarId: SETTINGS.calendarId } }];
