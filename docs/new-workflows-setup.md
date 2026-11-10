# New pieces built 2026-11-10: setup steps (do these in n8n and Netlify)

Everything below is built and its code is tested on a computer, but none of it has run in your n8n yet. Import, switch on, then test each one once.

## 1. Customer receipt email (inside "Website - Form Alerts")
When a customer sends the SETUP form with an email, they now also get "We received your setup form for [business]". It tells them what happens next (about 4 business days), asks them to share their Google Calendar with you ("Make changes to events") and to find out who has the phone account login, and links to the change form.
- This is part of the updated Form Alerts workflow (import the new file, replace the old workflow, same key as before).
- In the **Build Form Email** node, the line `shareEmail:` is the Google account customers are told to share their calendar with. It is set to carter.robertson729@gmail.com. Change it if you use a different Google account for n8n.
- Test: send the setup form with your own email as the customer. You should get your own "NEW SETUP FORM" email AND the customer receipt.

## 2. Change requests (new page `change-request.html`)
- A customer fills in business name, what needs to change, details, and when it should start. You get "CHANGE REQUEST: [business] - [type]" with everything they typed, through the same Form Alerts workflow.
- Customers find it from the Support page, the footer, and the onboarding emails.
- To make the change: paste the email to Claude, then reply to the customer when done.

## 3. Support page (new page `support.html`)
Email link, a 5-step "test your receptionist" checklist, and six common problems with answers. A "Support" link was added to the footer on every page and to the signed-in account menu. Reply times say "2 to 3 business days" (matches the rest of the site). Change that wording if you want to promise faster.

## 4. Onboarding emails (new workflow "Website - Onboarding Emails")
Sends these automatically, once, to each customer:
- **Day 0** (the day you mark them live): "Your receptionist is live" with what to expect, a test tip, and the change form link.
- **Day 7**: a short check-in ("how is your first week going?").
- **Day 30**: "Your first month", asking for feedback, an optional testimonial, and a referral.
You also get a copy of each one ("Sent to [business]: ...").

How it works: every morning at 9:00 (Central) it reads a Google Sheet tab called **Customers** and sends whatever is due that exact day. It does not write anything back.

Set it up:
1. Make a Google Sheet (any name) with a tab named **Customers**. Row 1 headings: `Name | Email | Business | Plan | Live date | Receptionist number | Mode`
2. Add one row per customer when they go live. **Live date** must look like `2026-11-12` (year-month-day). Receptionist number is optional.
3. n8n: import `website-onboarding-emails.json`.
4. Open **Get Customers**: pick your Google Sheets credential, and paste that sheet's ID (the long code in its address) in place of `PUT-YOUR-CUSTOMERS-SHEET-ID-HERE`. Sheet name: Customers.
5. Open **Send Email** and pick your Gmail credential. Save. Switch the workflow **Active**.
6. Test: add a row for yourself with today's date and your email, open the workflow, and click **Execute workflow**. You should get the "Your receptionist is live" email plus a copy. Then delete the test row.

Notes: it only sends on the exact day, so if n8n was off that day, that email is skipped. If you add a customer late, the day-0 email is missed; send it by hand (the text is in the workflow's Find Due Emails node). It never emails anyone whose email is blank or looks wrong.

## 5. Failure alerts (new workflow "Receptionist - Error Alerts")
If any workflow errors, you get an email "n8n FAILED: [workflow] ([step])" with the message and a link to the failed run.
1. Import `receptionist-error-alerts.json`. Pick Gmail on **Email Me**. Switch **Active**.
2. n8n will NOT alert for a workflow until you point that workflow at this one. For EACH workflow: open it, click the three dots (top right) > **Settings** > **Error workflow** > choose "Receptionist - Error Alerts" > Save. Do it for these: Check Availability, Book Appointment, Cancel Appointment, Reschedule Appointment, Find Appointment, Callback Request, Urgent Alert, Owner Call Summary, Weekly Owner Report, Business Config, Website - Demo Booking, Website - Demo Manage, Website - Form Alerts, Website - Payment Welcome, Website - Onboarding Emails.
3. Test: duplicate any small workflow, add a Code node that says `throw new Error('test')`, set its Error workflow to this one, run it. You should get the email.
Limit: this catches workflows that error. It does not catch a workflow that never runs (for example Retell not calling n8n). The Monday weekly report already warns you when a shop got zero calls, so keep it on.

## Files
`n8n/website-form-alerts.json` (updated), `n8n/website-onboarding-emails.json`, `n8n/receptionist-error-alerts.json`, `website/change-request.html`, `website/support.html`.
