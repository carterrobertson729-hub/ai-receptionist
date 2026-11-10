// PASTE INTO n8n: workflow "Website - Form Alerts" > node "Customer Receipt" > Code tab (select all, replace, Save).
// Sends the customer a short "we got your setup form" email (built by the Build Form Email step).
var mail = $('Build Form Email').first().json.customer;
return [{ json: { to: mail.to, subject: mail.subject, body: mail.body } }];
