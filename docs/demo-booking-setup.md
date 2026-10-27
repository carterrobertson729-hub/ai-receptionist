# Website demo bookings -> your calendar + emails (setup)

Workflow file: `n8n/website-demo-booking.json` (name in n8n: "Website - Demo Booking").

What it does: when someone books a demo on the website, Netlify sends the request to n8n. n8n checks your calendar for that time, adds a "DEMO: name (business)" event, emails you the details, and emails the visitor a confirmation. If your calendar is already busy at that time, nothing is added; you and the visitor get a "please pick another time" email.

## Steps
1. n8n: Workflows > Import from file > pick `website-demo-booking.json`.
2. Open the nodes with a red warning and pick your accounts: Get Calendar Events and Create Demo Event (Google Calendar), Send Email (Gmail).
3. Calendar: the code nodes use `calendarId: 'primary'` (the Google account connected in n8n). To use a different calendar, change `calendarId` in the Read Request node (and the Build Emails node keeps the same SETTINGS block).
4. Save, then switch the workflow to Active (top right).
5. Open the first node (Netlify Demo Form) and copy the PRODUCTION URL. It looks like https://icrob.app.n8n.cloud/webhook/website/demo-booking . Add `?key=46e6486d1b217038c635` to the end.
6. Netlify: your site > Forms (or Site configuration > Forms > Form notifications) > Add notification > Outgoing webhook. Form: demo. URL: the address from step 5 with the key. Save.
7. Keep your existing Netlify email notification too, as a backup.
8. Test: book a demo on the website with your own email. You should get both emails and a calendar event within a minute.

## Notes
- The key in the URL stops strangers from sending fake bookings to n8n. If it leaks, change `secret` in the Read Request node and the URL in Netlify.
- Times are Central Time. Change `tz`, `tzLabel`, `minutes` in SETTINGS if needed.
- The website still shows a time as available after it is booked (it does not look at your calendar). The workflow protects you: a second person who picks a taken time gets the "please pick another time" email.
- Netlify's outgoing webhook body format was written from memory of its docs. If the test does nothing, open the n8n Executions list and look at what arrived.

## Part 2: hide booked times and let people change or cancel (2026-10-27)

New workflow file: `n8n/website-demo-manage.json` ("Website - Demo Manage"). It has two small flows:
- `website/demo-slots` returns the times already booked on the demo calendar, so the booking page hides them. A cancelled demo disappears from the calendar, so its time opens up again by itself.
- `website/demo-change` looks up or cancels a demo from the link in the confirmation email (page `demo-change.html`). Only calendar events whose title starts with "DEMO:" can be touched.

Steps:
1. n8n: Import `website-demo-manage.json`, pick your Google Calendar account on the three calendar nodes (Get Busy Events, Get Demo Event, Delete Demo Event) and your Gmail account on Send Cancel Email, save, switch Active.
2. In the booking workflow ("Website - Demo Booking"), open the Build Emails node and paste in the new `website-demo-booking__build-emails.js` (it adds the change/cancel link to both emails).
3. Upload the new website folder (it has the new `demo-change.html`, and `demo.js` now hides booked times).
4. Test: book a time, check it disappears from the booking page, open the link in the email and cancel, then check the time is available again.

Notes:
- The website talks to n8n at the address `N8N_BASE` at the top of `site.js` (your n8n cloud address + /webhook/website/).
- The link in emails uses the website address Netlify sends with each form. If the link is missing from the emails, set `siteUrl` in the SETTINGS of the Build Emails node.
- If someone books the same time at almost the same moment, the booking workflow still catches it and emails both people to pick another time.
