# AI Receptionist for local service businesses — project guide

This file is the single source of truth for the project. Read it at the start of every session. When Carter makes a decision or adds an idea, update this file in the same session.

## Who you're working with

- Carter owns the project and makes the design decisions. He is selling this as a real product to real businesses.
- Assume he is not a professional developer. Explain steps in plain language, say where to click, and have him test after each step.
- Before recommending any provider, check current pricing and terms. This area changes fast.

## What this is

An AI phone receptionist for local service businesses. It answers calls the business would otherwise miss (staff busy, or business closed), and books appointments so the caller doesn't go to a competitor. It does not replace staff; it only picks up calls that would have gone to voicemail. Businesses keep their existing phone number and forward calls to the AI.

Target customers (decided): trade contractors (electricians, plumbers, HVAC), repair shops, landscaping companies. Recommended launch order (not yet confirmed): residential service trades first, then repair shops, then landscaping. Best target is a company with service trucks that advertises emergency/24/7 service.

## Decided stack

| Part | Choice | Notes |
|---|---|---|
| Voice agent | Retell AI | Carter has history with it. Vapi is the main alternative; not enough better to switch. |
| Workflows | n8n Cloud | All actions live here as webhook endpoints. |
| Calendar | Google Calendar | A new calendar will be made for the demo. |
| Phone and SMS | Twilio | Sell via Twilio's ISV route (register ISV brand, then each customer as its own brand/campaign). |
| Payments | Stripe payment link sent by text | Never take card numbers by voice (PCI). Milestone 2, not first version. |

## Architecture rules

1. Retell owns the conversation: prompt, safety script, emergency sorting, language switching.
2. n8n owns actions only. Each action is its own webhook with clean typed inputs: check availability, book, cancel, reschedule, check appointment, text on-call, text owner, log call.
3. One config record per business (name, greeting, trade, hours, services, emergency definitions, on-call rotation, owner number, calendar ID, fixed prices, never-say list). n8n looks the business up by the number that was called. Adding a customer is setup, not a code change. Never hard-code business details in code nodes.
4. Do not parse natural-language dates in code. Give the agent today's date and the business time zone, and have it send ISO dates. Use Google Calendar free/busy for open slots. Mind time zones; do not use UTC `toISOString()` for local dates.
5. Check the actual Retell payload shape before writing parsers. Custom function calls arrive as `{ name, args, call }`, where `name` is the function name. Verify against current Retell docs.
6. Calendar is the source of truth for bookings. No separate booking database.
7. Config storage: n8n Data Tables or a small Postgres/Supabase table (no Google Sheets).

## First-version requirements

1. Answer with the business name and a natural greeting.
2. Collect name, callback number, address, and problem description.
3. Book into the business's calendar within allowed hours and job types, after checking for conflicts.
4. Text the owner a summary after every call.
5. Hand off emergencies to a person.
6. Never quote prices unless the business supplied fixed prices. Otherwise say pricing comes from the business.
7. Say plainly it is an automated assistant if asked.
8. Fall back safely: if it can't understand or can't book, take a message and text the owner.

Added by Carter in this session:
- Speak other languages when the caller needs it (start in English, switch; test each language before promising it to a business; Spanish is the likely first).
- Confirmation text to the caller after booking.
- Pay a tab through the AI via a texted payment link.
- Transfer to a human on request (warm transfer, fall back to message-taking).
- Take calls overnight so the business loses no sales.
- Cancel, reschedule, and check appointments.

Trades extras: emergency vs routine sorting; on-call dispatch with escalation (on-call, then next person, then owner) and a simple way to update the rotation; safety script is non-negotiable (gas smell, sparking panel, smoke, flooding near electrics: first say get to safety and call the gas utility or 911, only then take details); full job details (address, problem, callback number, whether anyone is at the property).

Repair shops: callers ask "how much for X" and "is my car ready"; collect vehicle year/make/model. Landscaping: mostly estimate requests, so book a site visit or callback; collect property address and type of work.

## Not in the first version

General-purpose product for any business; outbound sales calls; custom mobile app; card numbers by voice.

## Build order

1. Agent prompt, check-availability and booking workflow, confirmation text (one after-hours plumbing call from start to finish, using a sample config).
2. Emergency sorting and on-call dispatch with escalation.
3. Transfer to a human.
4. Other languages.
5. Payment link.
6. Call log and owner summary text.

## Current state

- Repo layout: `config/` per-business JSON, `n8n/` workflows (generated by `tools/build-workflows.mjs` from `n8n/code/slots.js` and `config/*.json`), `retell/` prompt and tool definitions, `tools/` build and tests. See README.md for setup steps.
- WORKING end to end (tested by Carter in real n8n Cloud + Retell web calls, 2026-10-09): check availability, book appointment, duplicate-safe booking, taken-slot handling, asks preferred day and morning/afternoon, no area-code ask, offers to repeat phone/address, says when no later slot exists. Slot logic has 13 passing unit tests.
- Live setup: n8n Cloud (icrob.app.n8n.cloud), both workflows active, header-auth secret `X-Receptionist-Secret`, demo Google Calendar (Chicago time), Retell single-prompt agent with the two custom functions. The Twilio "Text Confirmation" node is DEACTIVATED in n8n until Twilio is approved. Prompt tells the agent not to promise confirmation texts until then.
- The demo prompt Carter pastes into Retell is `retell/demo-plumbing-prompt.txt`. It is GENERATED: edit the template `retell/agent-prompt.md` (wording) or `config/demo-plumbing.json` (facts), then run `node tools/build-prompt.mjs`. Never hand-edit the generated file.
- TESTED OK by Carter (2026-10-09): urgent alert via web call (URGENT email arrived with full details). Still to confirm: gas/safety script call, owner summary email arrival.
- BUILT: owner call summary email (workflow `owner-call-summary.json`, Retell agent-level webhook + post-call analysis fields), urgent alert (workflow `urgent-alert.json`, Retell tool `report_urgent_call`; emails the on-call person from `config.people`/`onCallSchedule` plus the owner, no ack/escalation yet because email is not a real paging channel). Prompt urgent section now calls the tool and only says someone was alerted if it succeeded. Next upgrade: SMS + phone-call paging with acknowledgement and escalation once Twilio is approved.
- Demo scheduling rules (2026-10-10): open 8-5 every day, 2-hour visits that can start every 30 minutes, 30-minute gap between jobs, offers spread at least 60 minutes apart (`slotStepMinutes`=30, `bufferMinutes`=30, `offerSpacingMinutes`=60). Gap also blocks the time before a job; default visit length 2 hours.
- Owner summary email filter (2026-10-10): sends for urgent, booked, message-taken, or any call where the caller left name + number; skips hang-ups and empty calls. Set per business in `config.notifications.emailOutcomes`. Idea for later: once-a-day digest for booked calls instead of instant email; urgent calls currently also get the summary as a safety net in case the alert failed.
- Pricing (2026-10-10): per job type in `config.services[].pricing`: `flat` (AI states the exact price), `quote_on_site` (AI states only `serviceCallFee`, books the visit), `callback` (no price, no booking; takes details, outcome becomes a message -> owner email). Demo prices are made-up placeholders. Customer setup question: which jobs have a firm price, which need a look first, what is the service call fee, any after-hours surcharge, payment methods.
- Big jobs (2026-10-10): pricing type `big_job` (water heater replacement, sewer line, repipe in the demo; all prices placeholders). Agent may share only `typical` range + `startingAt` floor as an estimate, never a quote, and offers non-forced choices: book a short on-site ESTIMATE visit (`durationMinutes` = estimate visit length, `jobMinutes` = real job length, kept for future use; calendar title `ESTIMATE VISIT: ...`), and/or a callback via the `request_callback` tool -> workflow `callback-request.json` emails the office (config `callbackEmail`, else ownerEmail). Post-call analysis `outcome` needs a `callback` choice; the summary email skips `callback` outcomes (`notifications.skipOutcomes`). Callbacks ALSO create a 15-minute calendar entry titled `CALLBACK: <job> - <name>` at the caller's chosen day/time (tool args `callback_date` YYYY-MM-DD + `callback_time` HH:MM; else the next open time), marked Free (transparent) so it never blocks technicians, colorId 11 (red). Calendar node field names `showMeAs` and `color` were written from memory: verify in n8n. The calendar step has onError=continue so the email always goes out. Customer setup question: for your ~10 biggest jobs, the starting price, typical range, and whether the estimate visit is free or paid.
- Update flow (2026-10-10): `node tools/build-workflows.mjs` also writes `n8n/node-code/*.js` (one file per Code node, header says where to paste). Prefer sending Carter only the changed node files (compare with `git diff --name-only n8n/node-code`) over whole workflows; re-import only when nodes are added/removed/rewired. Planned: central config workflow so business facts live in one place instead of 5 nodes.
- Exact-time lookup + big-job choice (2026-10-10): check_availability now accepts `preferred_time` (HH:MM) and returns `requestedTime {available, reason}` with that exact time first (fixes: a named time used to be cut off after the earliest 3 offers, which made the agent say 'not available' wrongly). Big jobs take `visit_type`: `job` = full job length (`jobMinutes`), `estimate` (default) = short estimate visit (`durationMinutes`). The agent must ask the caller to choose book-now / free estimate / callback; it never picks for them.
- Callback times + multi-day jobs (2026-10-10): check_availability `purpose: "callback"` returns times the OFFICE can phone back (office hours, 15-min slots every 30 min, ~30 min notice, ignores technician jobs, skips slots already holding a `CALLBACK:` entry); the agent offers those and passes the choice to request_callback. Services flagged `multiDay: true` (demo: sewer line, repipe) are never booked as the job: only estimate visit or callback. `CALLBACK:` calendar entries never block technician slots even if the Free flag failed to apply. A long job can start any time as long as it ends by closing with the 30-min gap (an earlier 3h booking is why 11:30 was the next start).
- Offers are spread, not earliest-three (2026-10-10): with no specific time, offerSlots returns the earliest + a middle + a late opening on the first day that has any (prefers on-the-hour starts, honors offerSpacingMinutes, never repeats a time; short days are topped up from following days). Morning request = e.g. 8:00 / 10:00 / 11:00. The agent must always ask morning vs afternoon before checking times. Demo office closes at 5 PM so there is no real evening; late starts are ~3-4 PM.
- CONFIRMED WORKING by Carter in real calls (2026-10-10): spread offers incl. 11:00 + morning/afternoon question, exact-time lookup, book-now vs estimate visit for big jobs, multi-day jobs, callback with pickable times + CALLBACK calendar entry, job-type durations + 30-min gap, flat/quote/big-job pricing, urgent alert, summary email filter. Not yet verified live: callback entry shows as Free/red in Google Calendar (check once).
- Cancel / reschedule / check (2026-10-10, BUILT, not yet tested live): workflows `find-appointment.json`, `cancel-appointment.json`, `reschedule-appointment.json`; Retell tools `check_appointment`, `cancel_appointment`, `reschedule_appointment`. Caller must give the phone AND a matching name (stored in the event description by the booking workflow); only events whose description says 'Booked by AI receptionist' are touched (never hand-typed events or CALLBACK entries). Cancel deletes the calendar event and emails the office; reschedule updates start/end (same length) and appends 'Rescheduled by caller from ...'. Lookups search ~45 days ahead. New bookings now write a `Job type:` line. Post-call `outcome` choices should now be: booked, estimate, callback, cancelled, rescheduled, message, urgent, other (summary email skips callback/cancelled/rescheduled). Google Calendar node fields for delete (`eventId`) and update (`updateFields.start/end/description`) were written from memory: verify in n8n.
- Known limits: only the one configured calendar is read (other calendars are invisible); fixed 2-hour visits on a 2-hour grid (last start 2 PM); urgent alert is email only (no paging or escalation until Twilio); no transfer; web test calls have no caller ID.
- NEXT (agreed with Carter): 1) owner summary after every call (email first, SMS once Twilio is approved; needs Retell post-call webhook to n8n), 2) emergency handling and on-call dispatch, 3) transfer to a human, 4) cancel/reschedule/check, 5) languages, 6) payment link. Waiting on Carter: owner email for summaries, whether n8n has an email account connected (Gmail), Twilio account + ISV registration started.
- Config is interim: `build-workflows.mjs` inlines `config/*.json` into the Load Business Config node. Move to an n8n Data Table once there is more than one business.
- Retell facts verified from docs search: custom function body is `{ name, call, args }`; signature header is `X-Retell-Signature`; plain `{{current_time}}` is Pacific, use `{{current_time_America/Chicago}}`; multilingual via the language Multiselect. Currently using a shared-secret header; consider signature verification later. The test secret appeared in chat once; rotate before any real customer.

## History

Carter built one earlier attempt (a pressure washing receptionist on Retell + n8n + Google Calendar/Sheets, brand "SparkClean"). The account is down and nothing from it is active or reusable. Known lessons: a Code node that read top-level fields instead of Retell's `args`; fragile date parsing; hard-coded business details; debugging by guesswork instead of reading the failing execution. Do not carry that design forward.

## Open items

- BUILT 2026-10-10: job types with their own visit length (`services[].durationMinutes`; the agent picks the closest routine job type and passes `service` to check_availability and book_appointment; unknown types get the 2-hour default). Still open: per-type gaps, and travel-time-based gaps via a maps API. Setup question for every customer: how much time do your techs need between jobs, and how long are your typical jobs?
- Twilio ISV registration (ISV brand first; approval takes days to weeks). Texting at volume is blocked until done.
- Check vendor terms for reselling: Retell, n8n Cloud (plan and license limits), Twilio, Google, Stripe. Get written confirmation from each. Short lawyer consult before the first paying customer.
- Customer agreement: what is collected (recordings, names, addresses), retention, who can see it.
- Call recording consent and AI-disclosure rules vary by state. Confirm for each state served. Write an AI disclosure into the greeting.
- Which scheduling tools the first real customers use (Jobber, Housecall Pro, ServiceTitan?).
- Pricing: monthly fee, setup fee.
- Launch industry confirmation.
- How owners change settings: web page, or Carter does it for them at first.
- Per-call cost: roughly $0.11 to $0.37 per minute all-in on Retell (third-party figures; verify on vendor sites).

## Market context (vendor-sourced, treat as optimistic)

Roughly 30 to 40% of local service calls arrive after hours; about 28% of business calls go unanswered. Many ready-made AI receptionists already exist, and phone and scheduling software are adding the feature. Sales is the hard part. Goal: sign three paying businesses in one industry from a working demo before building much more.
