# Tonic Barbershop: pitch pack (draft 2026-10-15)

Everything marked [ASK] must come from the owner. Do not quote numbers in this pack as facts until she confirms them.

## 1. The 30-second pitch
"Your barbers are busy cutting hair and can't answer the phone, so callers who want an appointment hang up and call the next shop. I set up an assistant that answers every call you miss, books them straight into your calendar, and answers the usual questions (prices, hours, who's in). I can have a demo ready for you to call, built on your real prices and services. It takes about two minutes to hear it."

## 2. What it does for Tonic (based on their Square booking page)
- Answers when the shop is busy or closed, with Tonic's name.
- Knows all 16 services, prices and lengths (haircut $27, boys cut $22, senior cut $16, bald fade $30, and so on), and adds up combos.
- Books by day and time, up to the number of barbers working, and notes a preferred barber (a request, not a promise).
- Checks, cancels and reschedules appointments.
- Takes a message or sets up a callback for anything else.
- Emails the owner a summary of booked calls. Every call is logged in a sheet with business hours vs after hours.
- Not yet: confirmation texts (needs texting approval), transfer to a person, and writing straight into Square (the demo uses a Google Calendar).

## 3. Demo script (5 minutes)
1. Have the owner call the demo number from her own phone and say: "Hi, I want a haircut and a beard trim on Saturday morning."
2. Let her hear it offer times, ask for a name and number, and confirm.
3. Show the event on the demo calendar, 45 minutes long.
4. Call again and ask: "How much is a boys cut?" then hang up without booking. Point out it never asked for her details.
5. Ask her to try to break it: ask for Kayleen, ask about a service they don't offer, ask for Monday.
6. Show the call log sheet: every call, the time, and whether it was during business hours or after.

## 4. Questions to ask the owner [ASK]
1. About how many calls do you miss in a typical week? When are the worst times (a Saturday rush, evenings)?
2. How many of those callers would have booked?
3. Who answers the phone now when everyone is busy? Does it ever just ring out?
4. Do you take walk-ins? Do customers usually ask for a specific barber?
5. What are your real hours? Which barbers work which days?
6. Is there a no-show or late-cancellation policy? A deposit?
7. What do you want the assistant to say or never say?
8. Do you want a text confirmation sent to customers?
9. How do you handle phone calls about products, jobs, or complaints?
10. What would make you trust it? What would make you stop using it?
11. What would be a fair monthly price? Too much?
12. Who else decides? When could we start a trial?

## 5. Money math [fill in with the owner's numbers]
- Missed calls per week: [ASK] x callers who would have booked: [ASK] x average ticket (a haircut is $27; a haircut plus beard trim is $39) x 4 weeks = money left on the table per month.
- Example for illustration only: 10 missed calls a week, half would book, at $27 = about $540 a month. This is a made-up example. Use the owner's numbers.
- A barbershop ticket is small, so the price must be small too. The product should pay for itself with a handful of extra cuts a month.

## 6. Pricing (tiers chosen with Carter 2026-10-16; still suggestions until tested with real owners)
My measured Retell cost is about $0.166 per minute ($10.21 for 61.52 minutes), plus about $2 per phone number, a share of n8n and Claude, and card processing. Overage at about $0.50 a minute is three times cost.

| Plan | Included minutes | Price per month | Rough cost if fully used | Rough profit |
|---|---|---|---|---|
| Starter | 300 | $179 | ~$80 | ~$99 |
| Standard | 500 | $249 | ~$115 | ~$134 |
| Plus | 750 | $339 | ~$150 | ~$189 |
| High volume | 1,200 | $499 | ~$235 | ~$265 |

- Spanish add-on: $25 to $35 a month (Carter is testing willingness to pay), almost all profit.
- One-time setup fee: about $149 to $299 (can be waived for the first shop in exchange for a testimonial).
- Pilot: 2 weeks free or cheap, on a forwarded number, so the owner sees real bookings in the call log.
- Barbershop tickets are small ($27 haircut, $39 haircut plus beard trim): $179 needs about 6 to 7 extra bookings a month to pay for itself. Start the first shop on Starter or Standard.
- Raise prices for new customers after the first 3 customers and once the call log shows results.

## 7. What to say to objections
- "I already have someone answering": "This only catches the calls nobody picks up, evenings and when everyone is busy."
- "Will it sound like a robot?": Let her hear the demo. It tells callers it is an automated assistant if asked.
- "What if it books wrong?": It only offers times from the calendar, and the owner sees every booking by email.
- "I use Square": Today it books into a calendar. Writing into Square is the next step if she wants to go ahead; I will confirm with Square's current documentation before promising it.

## 8. What to do before the meeting
1. Run all the test calls in the earlier checklist and fix anything that fails.
2. Confirm the real hours, time zone and number of barbers with the shop.
3. Get a phone number to put on the demo so the owner can call from her own phone (a Retell number costs about $2 a month).
4. Decide your pilot offer and price.
5. Read the Retell, n8n, Google and Square terms about reselling.
