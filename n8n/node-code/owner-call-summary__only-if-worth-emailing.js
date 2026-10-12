// PASTE INTO n8n: workflow "Receptionist - Owner Call Summary" > node "Only If Worth Emailing" > Code tab (select all, replace, Save).
// Only calls worth an email go on to the email step (the call log above gets every call).
var j = $input.first().json;
return j.send ? [{ json: j }] : [];
