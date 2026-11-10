# Two bigger features that need something from you first (prepared 2026-11-10)

I can't build these yet. Each one needs an account or a person that only you can bring. This is exactly what I need and what it unlocks.

---

## A. Text messages (Twilio)

### What it unlocks
- **Confirmation text to the caller** after they book ("You're booked Saturday at 9:30").
- **Missed-call text-back** (a short text after a call the receptionist couldn't finish).
- **Urgent alerts by text** for plumbing and home services, instead of email only. This is the biggest gap for trades.
- A texted payment link for balances (later).

### What is already done
The booking workflow has a Twilio text node that is switched OFF, and the agent prompts avoid promising texts. A config flag `smsEnabled` turns the wording on per business. See `docs/twilio-registration-plan.md` for the registration plan.

### What I need you to do
1. Create a Twilio account (twilio.com). Do not paste any keys in chat.
2. Start registration for US business texting (called A2P 10DLC): your brand first, then a campaign for appointment confirmations. Approval takes days to weeks, so start it before you need it.
3. Buy a Twilio number for texting. In n8n, add the Twilio credential yourself (Credentials > New > Twilio) and tell me when it exists.
4. Decide the sender name that appears in texts (for example "AnswerBay for Tonic Barbershop").

### Rules I'll build in
Every first text says who it's from and how to stop ("Reply STOP to opt out"). No marketing texts. Only people who just called get a text. Check the rules in your state before you start.

### When to do it
After you have 2 or 3 paying shops. Until then say honestly: "Confirmations by email. Texts are coming." The site already says this.

### Cost (verify on Twilio's site)
A number is about $1 to $2 a month. Texts are about a cent each, plus registration fees. Plan for roughly $15 to $30 a month in setup and fees once registered, plus pennies per text.

---

## B. Square connection (barbershops that book in Square)

### Why it matters
Tonic's real bookings live in Square. Today the receptionist books into a Google Calendar, so it can't see Square bookings and could double-book. A Square connection fixes that and makes barbershops take it seriously.

### What the Square docs say (found by search 2026-11-10; check each point on Square's site before relying on it)
- Creating, changing or cancelling bookings for a seller needs the seller to be on a **paid Square Appointments plan** (Plus or Premium). The free plan is more limited.
- Your app needs write permissions for bookings, granted by the shop owner herself on Square's own "Allow" screen. You never see her password.
- **Barbers must already be "bookable" in Square.** The API can't make a team member bookable; the owner does that in her Square dashboard.
- Square can search availability for a service and tells you which team members are free for each slot. That fits "any barber" or "Kayleen specifically".
- Creating a booking needs the location, the start time, the team member and the service (from Square's catalog).
- Bookings that carry a **cancellation fee can't be created through the API**.

### What I need
1. **From you:** a free Square developer account (developer.squareup.com) and a test app. Start in Square's sandbox, which is free and has fake data.
2. **From Tonic's owner** (only once she is interested): which Square plan she pays for, whether each barber is set up as bookable, whether any service has a cancellation fee, and her OK to connect.
3. **From her, on her own device:** click "Allow" on Square's connect screen. We then store the permission in n8n.

### What I'd build (in this order)
1. Check availability (per service, any barber or a named one).
2. Book (with barber alternatives when the first choice is taken).
3. Cancel, reschedule, and look up appointments.
4. Settings per shop for the location ID and the lists of services and barbers.
5. Prompt changes: "Kayleen is booked at 4, Lauryn is free at 4 or Kayleen at 4:30."
Then test in the sandbox, then with a real booking.

### Honest risks
All the Square details here come from documentation searches, not from a test. Square can change plans and permissions. This is a medium-sized build, so I'd only do it once a shop will pay for it.
