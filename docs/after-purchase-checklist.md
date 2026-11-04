# After a customer pays: get them their own phone number (checklist)

Key idea: the customer KEEPS their shop number. You buy a separate Retell number for them. They forward missed or after-hours calls to it. Callers never see the Retell number (unless they choose the 24/7 mode and publish it).

## Where their answers arrive
1. They fill in `setup.html`. It is a Netlify form named `setup`.
2. Netlify saves every submission under Netlify > your site > Forms > setup.
3. You only get an EMAIL if you turned on notifications: Netlify > Site configuration > Forms > Form notifications > Add notification > Email notification > pick form "setup" > your email. (If it is not set up, answers still sit in Netlify Forms, but nothing lands in your inbox.)
4. Test it once yourself: fill in the form with your own name and check that the email arrives.

## Steps to get their number (about 30 to 45 minutes of your time)
1. Confirm payment in Stripe (invoice or link paid).
2. Read their setup form answers. Paste them to Claude. Claude builds `config/<shop>.json`, the prompt and the Retell function list.
3. n8n: paste the updated Find Business code into "Receptionist - Business Config" (one box). Save.
4. Make their Google Calendar share (they share it with you) and a call log sheet (tab `Calls`, 11 headings). Put both IDs in the config.
5. Retell: create a NEW agent (not a copy that keeps another shop's text). Paste the prompt, add the functions from `retell/<shop>-tools.json` (addresses end in `?business=<shop>`), set the call-finished webhook (also `?business=<shop>`), set language.
6. Retell: Phone Numbers > Buy a number. Pick an area code that matches the shop (219 for Northwest Indiana, 708 or 773 for Chicago suburbs). About $2 a month.
7. Open the new number and set: Inbound agent = the shop's agent; Outbound = none; Fallback = blank; Inbound countries = US only.
8. Test by calling the Retell number yourself: booking, price question, cancel, after-hours behavior, call log row, summary email.
9. Send the owner the Retell number plus the forwarding steps (`docs/forwarding-emails.md`). Ask: who is your phone company, and who has the login?
10. On a call together, turn on forwarding, then call the shop's real number from your phone and confirm the AI picks up.
11. Remove test events from their calendar. Send a short "you're live" note and ask for feedback in a week.

## If a number is for a business that wants EVERY call answered
They can forward ALL calls (or publish the Retell number). The transfer number must not forward back to the AI. Transfer is still untested, so tell them it is coming.

## Costs to remember
Retell number about $2 a month (you pay, not the customer). Minutes are about $0.17 each. Put these in the price.
