# How AnswerBay works from start to finish (2026-11-07)

Written for Carter. Plain language. Every step says WHO does it, and each feature is marked:
- **Works** = you have tested it live
- **Built, untested** = the code and files exist, but nobody has run it live yet
- **Not built** = we have only talked about it

---

## 1. The big picture in one paragraph

A business keeps its normal phone number. It tells its phone company to send certain calls (the ones it misses, or all of them) to a separate "receptionist number" that you buy for them from Retell. A computer voice (the AI agent, built from the business's answers) answers that number, books the appointment in the business's Google Calendar, and emails the owner. You build the agent from the setup form the customer fills in. Everything runs on your accounts: Retell (the voice), n8n (the actions), Google (calendar, sheet, email), Stripe (payments), Netlify (website).

---

## 2. Two ways a customer arrives

### A. They find you on the website and buy (self-serve)
1. They read the home page, open **Pricing**, pick a mode and a plan, and click **Choose** (or go through the checkout page).
2. They land on a **Stripe checkout page** (your payment link). They pay the plan price plus the one-time **$99 setup fee** (first payment only). Then the plan renews monthly or yearly by itself.
3. Stripe sends them to your **payment-thanks page**: "Payment received", a **Fill out my setup form** button, a home button, and a 5-4-3-2-1 countdown to the form. (Set in each payment link's After payment tab.)
4. At the same moment, Stripe tells **n8n**, which sends:
   - the **customer** an email: "Thank you! Your next step", with their setup link (plan, name and email filled in, plus a payment reference);
   - **you** an email: "PAID: name - amount (plan)".
5. They fill in the **setup form** (15 to 20 minutes). When they send it, they see a confirmation page, then go to the home page after 3 seconds.
6. **You** get a "NEW SETUP FORM" email with every answer. If they typed a website, it also has a **WEBSITE SCAN** (title, phones, hours lines, prices it found on the first page).
7. You build their agent (section 4). About 4 business days after the form arrives is what the website promises.

Status: payment links and the Stripe-to-n8n workflow are built and you tested the two emails (Works). Live-mode Stripe is not switched on yet.

### B. You reach out and they say yes (your outreach)
1. You message or visit a shop and point them to the demo line **(219) 587-7319**.
2. They try it. You ask the qualifying questions (`docs/outreach-pack.md`).
3. They say yes. You send them a **Stripe payment link** for the plan they want (copy it from Stripe, or send them to your pricing page). Same price, same $99 setup fee.
4. After they pay, **the same automatic chain runs** (steps 3 to 7 above), because the Stripe webhook fires on any paid checkout.
5. If you take money another way (invoice, cash), the automatic emails don't fire. Then you send them the setup form link yourself: `https://endearing-macaron-e2b7a6.netlify.app/setup.html`.
6. Add-ons (Spanish, extra number) are NOT on the payment links. Add them to the customer's subscription by hand in Stripe, or tell them it's coming.

Tip for outreach: ask "who do you pay for your business phone and who has the login?" BEFORE promising a start date. Forwarding is the step that most often takes longer.

---

## 3. What the customer has to do (the whole list)

1. Pay (Stripe link).
2. Fill in the setup form: business name, hours, services with prices and lengths, staff, how they want calls answered, calendar, policies, where summaries go, who pays the bills, which state they are in.
3. **Share their Google Calendar with you** (permission "Make changes to events"). If they use Square, the demo version can't see Square yet (see section 8).
4. Tell you who their phone company is and who has the login.
5. **Turn on call forwarding** to the receptionist number you send them (you walk them through it).
6. Do a final test call with you, and tell their staff the plan.
7. If something changes (new prices, hours), email you.

---

## 4. What YOU do after the setup form arrives (building their agent)

This is the checklist in `docs/after-purchase-checklist.md`, written out:

1. **Check Stripe**: find the payment (the form email shows a Payment ref). Don't build before you see it.
2. **Paste the form answers to Claude.** Claude writes their settings file (`config/<shop>.json`), their agent prompt, and their list of Retell functions.
3. **n8n**: paste the updated settings into the "Receptionist - Business Config" workflow, in the "Find Business" box (one place for every business).
4. **Google**: they share their calendar with you; you make a "call log" Google Sheet for them (tab named Calls, 11 headings). Put both IDs in their settings.
5. **Retell**: make a NEW agent (not a copy of another shop's), paste the prompt, add the functions with `?business=<shop>` on the end, set the call-finished webhook, choose language and voice, set post-call fields.
6. **Retell number**: buy a number (about $2/month, area code like the shop's, e.g. 219 for Northwest Indiana). Open it and set: inbound agent = their agent, outbound off, fallback blank, US only.
7. **Test it yourself** by calling that number: book, cancel, ask a price, check the call log row and the summary email.
8. **Send the customer** the number and the forwarding steps (`docs/forwarding-emails.md` has drafts per phone company).
9. **Together on a call**: they turn on forwarding, you call their real number and confirm the AI picks up.
10. Remove test appointments from their calendar. Send a "you're live" email. Check in after a week.

Time cost: about 30 to 45 minutes of your time per shop once you've done a few. Time Claude takes: minutes.

---

## 5. How the phone number works (this is the part most people get confused about)

There are TWO numbers:
- **The shop's own number** (what customers see on Google and the door). It does NOT change.
- **The receptionist number** (the Retell number you buy). Customers never see it. The shop's phone company sends calls to it.

### Option 1: "If you miss a call" (backup mode)
Name on the website: **After-hours and missed calls** (Backup Lite, Standard, Plus).
- The shop's staff answer the phone first.
- If nobody answers after a few rings, or the shop is closed, the phone company forwards the call to the receptionist number.
- This is set up with the phone company's **conditional forwarding** (forward when busy / no answer / after hours). Cell carriers use dial codes (examples in `docs/forwarding-emails.md`: Verizon `*71` to turn on and `*73` to turn off; AT&T and T-Mobile use `**004*number#` or `**61*number**20#`, off with `##002#`). These codes are **not tested** and vary by plan, so try them on your own phone first.
- Business phone systems (RingCentral, Google Voice, etc.) have their own settings page for this.
- The agent opens with "...the office can't take your call right now, but I can help."

### Option 2: "Answer every call, all day and night" (24/7 mode)
Name on the website: **24/7 receptionist** (Starter, Standard, Plus, High volume).
- The shop forwards **all** calls to the receptionist number (unconditional forwarding), or publishes the receptionist number as its main number.
- The agent opens with "Thanks for calling X. How can I help you today?"
- If a caller asks for a person during open hours, the agent can try to transfer to a staff number. **Transfer is built but untested and switched off.** It needs a Retell transfer tool, a transfer number that does NOT forward back to the AI (or the call loops), and a real phone test. The website calls it "launching soon", so don't promise it yet.
- This uses far more minutes, which is why 24/7 plans cost more.

### What decides which one a shop gets
Two things: the plan they buy (backup plan vs 24/7 plan) and the setup form question "How should it answer?" (section 3). If they differ (say they buy a backup plan but pick "every call"), email them and fix the plan.

### Extra number add-on ($15/month)
Another receptionist number for a second location. It shares the plan's minutes. A second location with different hours or services still needs its own setup.

### If forwarding goes wrong
`docs/forwarding-troubleshooting.md` covers: they don't know how, no login, carrier can't forward, verification-code services, owner is nervous, odd behavior. Rule: don't make the shop change anything until you've tested the Retell number yourself.

---

## 6. What the receptionist does on a call (barbershop)

Works (tested by you): answers with the shop's name, asks the service, day, morning or afternoon, offers real open times from the calendar, takes the name and number, books it, handles a parent booking for a child, cancels an appointment (the calendar event disappears and the time can be booked again), Spanish in text chat.

Built, untested live: reschedule, "check my appointment", pricing/hours-only calls without taking details, the call log row for every call, the owner summary email, minutes alerts at 80% and 100%, weekly report email every Monday, Spanish by voice.

It says it is an automated assistant if asked. It never quotes a price the shop didn't give you. If it can't help, it takes a message and emails the owner.

For plumbing and home services: asks a safety question first (gas smell, sparking, flooding near electrics) and only then takes details, marks urgent calls, and emails the on-call person. Estimate visits and callbacks are built. Email alerts only (no texts yet).

---

## 7. Money: what comes in and what goes out

Comes in (Stripe): plan price each month or year, plus $99 setup once. Overage is $0.40 per extra minute, but **nothing bills overage automatically yet**. The system only emails you and the shop at 80% and 100% of the plan; you charge extra by hand (or move them to a bigger plan).

Goes out (what you pay): Retell about $0.17 per minute used, about $2 per phone number per month, n8n plan, Stripe fees (2.9% + 30 cents), Netlify (free for now), a domain later.

Rule of thumb from your price sheet: you keep roughly $45 to $200 a month per customer depending on plan and usage.

Refund and cancel (written on the site, not yet lawyer-reviewed): cancel any time, the plan runs to the end of the paid period, no refund for time already paid, but a full refund if you can't get it working. Yearly plans cancel by not renewing.

---

## 8. What is not built or not proven yet (be honest with customers about these)

- **Text messages** (confirmation texts to callers, texting owners, urgent paging): not built. Needs Twilio registration, which you parked.
- **Square**: Tonic's real bookings are in Square. The agent books into a Google Calendar, so it cannot see Square bookings and could double-book. Square connection is planned, not started.
- **Transfer to a person**: built, switched off, untested.
- **A customer login or dashboard**: not built. "Log in" is Google sign-in plus Stripe's billing portal link (not switched on). Changes go by email to you.
- **Live payments**: Stripe is still in test mode.
- **Phone-number fix** for real calls (the "ten digits" problem) is built but you haven't confirmed it on a real call.
- **Only one calendar** is read per business. Time zone assumed Central unless the form says otherwise.
- **Terms and privacy** were written by Claude, not a lawyer.
- **Call recording laws** differ by state (some need everyone's consent). The agent says it is automated if asked; consider adding it to the opening line.

---

## 9. Ideas worth adding (not discussed yet, or only briefly)

Ranked by how much they would help you sell and keep customers.

1. **A short onboarding email series** (automatic): welcome and what to expect, "how to turn on forwarding" for their phone company, "you're live" with the number, a day-7 check-in, a day-30 "here's what your receptionist did". Costs nothing to run and prevents "is this working?" emails. I can build it in n8n.
2. **Failure alerts for you.** If an n8n workflow or the Retell webhook breaks, you find out when a shop calls angry. Add an n8n error workflow that emails you, and a weekly check that each shop got at least one call.
3. **A "request a change" form** on the website (new prices, hours, holiday closures) that lands in your inbox with the shop's name filled in. Easier than emailing, and creates a record.
4. **Holiday and closure handling**: a setting like "closed Thanksgiving" so the agent says so and doesn't book it.
5. **Text-back and confirmations (Twilio).** Biggest missing feature. Do it once you have 2 or 3 paying shops. It also unlocks urgent paging for plumbers.
6. **A simple customer report page** (read-only): their last 30 days of calls from the call log sheet. A weekly email already exists, so this is optional.
7. **Square connection for barbershops.** Probably the thing that makes barbershops take it seriously. Worth doing once one owner commits.
8. **Case studies and testimonials.** After Tonic or your first customer has 2 or 3 weeks of calls: "42 calls, 11 bookings after hours." This is your strongest sales material. Ask for permission in writing.
9. **A referral offer** (for example one free month for each referral) once you have happy customers.
10. **A fallback if the AI is down.** Tell shops what happens: for example, conditional forwarding means a failure just goes to their voicemail. Mention this in the terms and FAQ so it isn't a surprise.
11. **Support process**: a support email address, how fast you reply, and a short "how to test your receptionist" page for customers.
12. **Business basics**: an LLC or registration, a business bank account, business insurance, and a lawyer for terms, privacy and refund wording. Do this before taking real money from strangers.
13. **A real domain and name.** It also fixes Google's sign-in logo, and it makes cold emails look more trustworthy.
14. **Security cleanups**: change the shared secret used by the agent's functions, and add proper Stripe signature checks on the payment webhook.

---

## 10. The next steps, in order

1. Confirm the live website shows version 2026-11-07a.
2. Switch Stripe to live and recreate the 14 links with the setup fee and the payment-thanks redirect. Send the links to Claude to put in the site.
3. Make one real small purchase and check the 3 emails (paid, welcome, setup answers).
4. Run the live agent tests (master test list).
5. Make the plumbing demo agent and a number, then record the 4 audio samples.
6. Start outreach: walk into 3 shops, ask Tonic's owner about nearby shops, fill in the prospect list.
7. Have a lawyer read the terms before the first real customer.
