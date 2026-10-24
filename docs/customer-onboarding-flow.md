# After someone buys or starts a trial: what happens and who does what

The website does NOT give anyone a phone number instantly. The number comes after you build their receptionist. The website promises: we reply within 2 to 3 business days, and most receptionists are live within about a week of ordering. Keep to that. Technical details of the build are in `docs/new-customer-setup.md`.

## The whole flow in one list

| # | Who | What | How long |
|---|---|---|---|
| 1 | Customer | Reserves a plan on the checkout page (or starts the free trial / books a demo) | 5 min |
| 2 | You | Netlify emails you the form (Forms notifications). For a reserved plan: send a Stripe payment link. For a trial: no payment | within 2 to 3 business days (aim for same day) |
| 3 | Customer | Pays the link (Stripe emails them a receipt) | |
| 4 | You | Send the WELCOME email (template A): setup questionnaire + calendar sharing steps | within 2 to 3 business days (aim for same day) |
| 5 | Customer | Fills the questionnaire and shares their Google Calendar with you | 15-30 min |
| 6 | You (with Claude) | Build: config file, prompt, Retell agent and functions, n8n settings paste, call log sheet, buy their Retell number ($2/month, you pay), attach it to their agent | 2-4 hours |
| 7 | You | Test calls: booking, cancel, reschedule, after hours, call log row, summary email | 30 min |
| 8 | You | Send the NUMBER email (template B): their new number and forwarding steps for their phone company (docs/forwarding-troubleshooting.md) | |
| 9 | Customer | Turns on call forwarding (you can do it together on a call) | 10 min |
| 10 | You + customer | One last test call through their real number. They are live | 10 min |
| 11 | You | Day 3 check-in call or email. Weekly report starts on the next Monday | |
| 12 | You | Trial only: when they use about 40 of the 50 minutes, email a plan offer (template C) | |

## Things to set up once
- Netlify: Forms, then Form notifications, so each form emails you.
- Stripe: one Payment Link per plan and billing period (monthly/yearly), with the $99 setup as a one-time item. Paste them into CHECKOUT_LINKS in site.js. Until then, buttons on the checkout page reserve a plan and you send the link by hand.
- A Google Form (or Tally form) with the questions from `docs/customer-setup-questionnaire.md`, so customers can fill it in online. Use its link in template A.
- Add-ons (Spanish, main line, extra number) are added by you after payment, because a Stripe link only covers the base plan.

## Email templates (copy and edit)

### Template A: welcome and questionnaire
Subject: Welcome to AnswerBay: your next steps

Hi [name],

Thank you for choosing AnswerBay. Here is what happens next:

1. Fill in this short setup form (about 15 to 30 minutes): [questionnaire link]
2. Share your Google Calendar with carter.robertson729@gmail.com and give it permission to "Make changes to events". Steps: Google Calendar, hover over your calendar, three dots, Settings and sharing, Share with specific people.
3. Reply with who your phone company is (Verizon, AT&T, T-Mobile, a business phone system) and who has the login for your phone account.

Once I have those, I build and test your receptionist. That usually takes a few business days. Then I send you your receptionist's phone number and walk you through the one setting you change on your phone. You keep your own number.

Questions anytime: just reply to this email.

[your name]

### Template B: your number and how to switch it on
Subject: Your receptionist is ready

Hi [name],

Your AnswerBay receptionist is built and tested. Its phone number is: [number]. This number is only for forwarding. Do not give it to customers.

To switch it on, set your phone to forward calls to that number. For [carrier], the steps are: [steps from docs/forwarding-troubleshooting.md]. You can forward only the calls you miss, or every call.

I can do this with you on a call if you like. After you switch it on, call your own business number from another phone and I will listen in. To turn it off any time, [turn-off steps].

[your name]

### Template C: trial is almost used up (trial customers only)
Subject: You have used most of your free minutes

Hi [name],

Your receptionist has used about [X] of your 50 free minutes, and handled [Y] calls so far. Here is what it did: [bookings, messages].

If you want to keep it going, the plan that fits your call volume is [plan] at [price] a month: [checkout link]. If not, just turn off call forwarding and everything goes back to normal. No charge either way.

[your name]

## What the customer sees on the website, step by step
1. They click a plan (or Free trial, or Book a demo).
2. Checkout shows the plan, add-ons and the total. Without Stripe links: "Reserve my plan". With Stripe links: "Continue to secure payment".
3. They see a confirmation, and you get an email.
4. They wait for your welcome email (same business day if you can).

## Open items
- Stripe account and links.
- A branded business email (the site shows your Gmail for now).
- Lawyer review of the terms before taking real payments.
- A confirmation email to the customer is not automatic yet (Netlify forms only email you). The checkout page says you will email them within one business day.
