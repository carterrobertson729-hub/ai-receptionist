# Pricing guide (draft 2026-10-20: suggestions, not decided; recheck after one month of real call data)

## The rule: one price list, by minutes
Every business pays for minutes of calls, because minutes are what cost you money (about $0.166 per minute measured: $10.21 for 61.52 minutes). So barbershops, repair shops, plumbers and any other trade all use the SAME plans. What differs is which plan fits them, and how you explain the value.

## Plans (monthly)
| Plan | Included minutes | Price | Price per minute | Your cost if fully used | Your profit if fully used |
|---|---|---|---|---|---|
| Starter | 300 | $179 | $0.60 | ~$80 | ~$99 |
| Standard | 500 | $249 | $0.50 | ~$115 | ~$134 |
| Plus | 750 | $339 | $0.45 | ~$150 | ~$189 |
| High volume | 1,200 | $499 | $0.42 | ~$235 | ~$265 |

Cost = Retell minutes x $0.166 + about $25 to $36 for everything else (phone number about $2, card processing about 3%, a share of n8n about $24 and Claude about $20, which are fixed no matter how many customers).
Rule: the lowest plan should leave you at least $85 a month if fully used (Starter leaves about $99).
Overage: about $0.50 per minute above the included minutes (three times your cost).

## Add-ons (monthly)
| Add-on | Price | Why |
|---|---|---|
| Spanish (English + Spanish) | $25 to $35 | Almost all profit. Needs a native-speaker test before promising it. |
| Main line + transfer (the AI answers every call and transfers to staff on request) | $25 to $50 | Extra setup and testing, a phone number, the transfer tool. Also uses many more minutes, so these shops need a bigger plan. |
| Extra phone number / second location | $10 to $20 | Each number costs you about $2 plus setup. |

## One-time setup fee
| Setup | Fee | What it includes |
|---|---|---|
| Standard | $199 to $299 | Settings, prompt, agent, Google Calendar, call log, forwarding call, tests |
| Custom / extra tools | quote it | Integration with their scheduling software (Square, Jobber, etc.), custom questions |
You can waive the setup fee for your first customer in exchange for a testimonial.

## Which plan fits which business
Estimate minutes = missed calls per month x average minutes per call (about 2 for a barbershop, about 3 to 4 for a repair shop or a plumber). If the AI answers EVERY call (main line), use all calls, not just missed ones. That is usually three times more.
| Business | Typical situation | Starting plan |
|---|---|---|
| Barbershop, backup mode | 100 to 200 missed calls x 2 min = 200 to 400 min | Starter (300) |
| Barbershop, main line | 400 to 600 calls x 2 min = 800 to 1,200 min | Plus or High volume |
| Repair shop / plumber, backup | 100 to 150 missed calls x 3.5 min = 350 to 525 min | Standard (500) |
| Repair shop / plumber, main line | 300 to 500 calls x 3.5 min = 1,000 to 1,750 min | High volume |
These call counts are examples. Use the owner's real numbers from the interview.

## Do trades pay more than barbershops?
The PRICE LIST is the same. The VALUE is not:
- A missed call at a plumber or repair shop is worth hundreds of dollars (industry estimates $200 to $500 or more, vendor figures), so one booked job pays for the whole month.
- A missed call at a barbershop is worth one $27 to $39 visit, so Starter ($179) needs about 6 to 7 extra bookings to pay for itself.
So: start barbershops on Starter or Standard and sell on "a few extra cuts a month"; start trades on Standard or Plus and sell on "one extra job pays for the year".

## Selling rules
- Free or cheap 2-week trial on a forwarded number, with the call log showing real bookings.
- Raise prices for NEW customers after your first 3 customers once you have results; give existing customers 30 to 60 days notice.
- Do not offer unlimited minutes. If asked, quote the High volume plan or a custom cap.
- Email Carter an alert at 80% and 100% of a plan's minutes (built): bill overage or offer the next plan.

## Quote worksheet (fill in per customer)
1. Missed calls per month: ____ (main line: all calls: ____)
2. Average minutes per call: ____
3. Minutes needed: ____ x ____ = ____  -> plan: ____
4. Add-ons: Spanish ____ / main line ____ / extra number ____
5. Monthly total: ____   Setup: ____
6. Your cost: minutes x $0.166 + about $30 = ____   Profit: ____ (should be at least 40%)

## Still to verify
- Whether Retell bills minutes while a call is transferred.
- Phone-line cost for real phone calls versus web calls (your measured rate came from tests).
- n8n execution limits and active-workflow limits on your plan.
- Whether card-processing is really about 3% on your payment tool.

---

## FINAL LAUNCH PRICE LIST (2026-10-20, built from Grok, ChatGPT, Gemini, Claude suggestions; Carter to confirm)

Monthly, month to month: Starter 300 min $149 | Standard 500 min $229 | Plus 750 min $309 | High volume 1,200 min $449.
Cost at full use (0.17/min + $2 number): about $53 / $87 / $130 / $206.
Add-ons per month: Spanish +$30 | AI answers every call with transfer +$40 | extra number +$15. Overage $0.60/min.
Setup one time: standard $199 | Spanish +$99 | main line with transfer +$99 | complicated systems quoted from $349.
First 3 customers: setup waived for a testimonial; monthly price locked 12 months. Raise prices for new customers after 3-5 customers and a month of real data.
Example (Plus + Spanish + main line): $379/month, setup $397, first month $776.
Unverified: transfer billing, phone vs web call cost, competitor prices, n8n limits at volume.
