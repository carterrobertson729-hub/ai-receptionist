# Master test checklist (run all at once, 45 to 60 minutes)

Use the name "Test Caller" and your own phone number for every call. After the calls, wait 3 minutes, then check the calendar, the Tonic `Calls` sheet, your email, and n8n Executions. Write PASS or FAIL next to each line and send me every FAIL with a screenshot of any red box.

## Before you start
- [ ] Retell: Tonic Barbershop agent has the latest prompt (it has a "Languages" section), Multiselect English + Spanish, a Spanish-capable voice, and all 6 functions end in `?business=tonic-barbershop` with the password header.
- [ ] Retell post-call `outcome` choices: booked, estimate, callback, cancelled, rescheduled, message, urgent, info, other/nothing.
- [ ] n8n: the 7 new workflows are active; the Text Confirmation node in Book Appointment is deactivated; logins reselected (Gmail x2, Sheets x2, Google Calendar, Retell password).
- [ ] Tonic Google Sheet: tab named `Calls`, row 1 has the 11 headings exactly.

## A. Tonic: information only (no details asked)
- [ ] "How much is a men's haircut?" says $27.
- [ ] "How much for a haircut and a beard trim?" says $39.
- [ ] "Are you open Monday?" says no; "what days are open?" matches Tue to Fri 4 to 6 and Sat 9 to 2.
- [ ] "Do you take walk-ins?" yes. "Do you take cards?" yes. "Where do I park?" says not sure, offers a message.
- [ ] It never asks for name or phone if you only ask about prices; hang up. A row appears with `info`, no email.

## B. Tonic: booking
- [ ] Men's haircut, Saturday morning: offers up to 4 times, books, no address asked. Event "Men's Haircut - Test Caller", 30 min.
- [ ] Haircut + beard trim: event is 45 min, price total said ($39).
- [ ] Ask for Kayleen: noted as a request, not promised; event description shows the preferred barber.
- [ ] 10-year-old son + you: Boys Cut ($22) and Men's Haircut ($27), booked one at a time.
- [ ] Bald fade for a child: $30, not the boys price.
- [ ] Book the same time up to 3 times: works; a 4th at that time is refused and alternatives offered.
- [ ] Ask for a time outside hours (Monday, or 8 PM): refused with the real hours.
- [ ] Booked call sends a summary email.

## C. Tonic: manage appointments
- [ ] Check appointment (name + number): reads it back.
- [ ] Wrong name or number: cannot find it, shares nothing.
- [ ] Reschedule to another day: event moves.
- [ ] Cancel: asks to confirm, event removed.
- [ ] Hand-typed event with the name and number in the description: found and cancellable.
- [ ] Callback request: picks a callback time, creates a red CALLBACK entry marked Free, emails the office.

## D. Spanish (with a native speaker if possible; see spanish-test.md)
- [ ] Switches to Spanish and stays in Spanish through the goodbye.
- [ ] Prices and times sound natural; the booking is correct (English service name, caller's name as spoken).
- [ ] French sentence: replies in simple English/Spanish and offers a message.
- [ ] Open the transcript in Retell: does it match what was said?

## E. Call log, report and minutes counter
- [ ] Every call above has a row on `Calls`: day in column B, right Hours (Business hours / After hours), right Outcome, Minutes filled.
- [ ] Nothing in columns past `Call ID`; no blank first row.
- [ ] Owner Call Summary Executions: Build Summary, Prepare Log Row, Log Call, Get Call Rows, Check Usage green. (Check Usage output of 0 items is normal.)
- [ ] Optional: ask me for a copy with the plan limit lowered to 3 minutes; the 80% and 100% alert emails arrive once each.

## F. Plumbing regression (the old demo still works)
- [ ] Book a leak repair for tomorrow morning: offers spread times, asks for address, books.
- [ ] Urgent: "pipe burst, water everywhere": URGENT email arrives.
- [ ] Gas smell: first words are get out and call 911, then details.
- [ ] Cancel and reschedule work.

## What to send me
For each FAIL: which line, what the AI said, and a screenshot of the n8n Execution or the Retell transcript.
