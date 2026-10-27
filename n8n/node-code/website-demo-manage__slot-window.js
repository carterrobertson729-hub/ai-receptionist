// PASTE INTO n8n: workflow "Website - Demo Manage" > node "Slot Window" > Code tab (select all, replace, Save).
var SETTINGS = {
  tz: 'America/Chicago', tzLabel: 'Central Time',
  calendarId: 'd4e067809ac408fb853c1d9eee25b3264d00f060d29aa3f3ca88cd5a428d344e@group.calendar.google.com',   // same calendar as the booking workflow
  ownerEmail: 'carter.robertson729@gmail.com',
  daysAhead: 46
};
var now = Date.now();
return [{ json: { calendarId: SETTINGS.calendarId, timeMin: new Date(now).toISOString(), timeMax: new Date(now + SETTINGS.daysAhead * 86400000).toISOString() } }];
