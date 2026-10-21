# Parked: items to finish the Tonic Barbershop demo (set aside 2026-10-20 at Carter's request)

Carter wants to start a repair shop business next. These stay open for Tonic and should be picked up later:

1. Price sheet: one-page handout with the four tiers, Spanish add-on, setup fee, overage (docs/tonic-pitch.md section 6 has the numbers).
2. Customer agreement: plain-language draft (price, minutes and overage, cancellation, data collected, who sees it, AI disclosure). A lawyer must review before use.
3. Weekly owner report: Monday email per business from the Calls sheet (calls answered, after hours, booked, messages, minutes used vs plan).
5. Waiting on something else: Square connection (owner interest), transfer (Retell number), texts (Twilio), the real test calls (docs/master-test-checklist.md).

Also still open for Tonic: shop's cancellation/no-show rule, day-by-day hours from the owner, delete `address` and rename `problem` in Retell post-call analysis.

- Same-barber double booking (2026-10-21): in the Google Calendar demo, a named barber is only a request saved in the event. Two callers can both book Kayleen at 4:00 as long as fewer than 3 appointments overlap in total. Carter decided NOT to fix this in the calendar version; Square knows each barber's real schedule, so the Square build handles it. Total capacity (3 at once, named or not) is already enforced.
