// PASTE INTO n8n: workflow "Receptionist - Callback Request" > node "Build Response" > Code tab (select all, replace, Save).
var made = $input.first().json;
var b = $('Build Callback Email').first().json;
var onCalendar = !!(made && (made.id || made.htmlLink));
return [{ json: {
  requested: true,
  onCalendar: onCalendar,
  message: 'The office has been emailed this callback request' + (onCalendar ? ' and it is on their calendar for ' + b.calendarWhen : '') + '. Tell the caller the office will call them back around the time they asked. Do not promise an exact time.'
} }];
