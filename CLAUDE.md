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
- Built (milestone 1): check-availability and book-appointment workflows, Retell prompt (with safety script and interim emergency wording), tool definitions, sample plumbing config. Slot logic has 13 passing unit tests (time zones, DST, all-day events, duplicates). Code nodes were also run against a stand-in for n8n.
- NOT yet run in real n8n, Retell, or Twilio. The Google Calendar node field names (getAll after/before, create start/end) were written from memory and must be checked after import.
- Carter has: a new Google Calendar, a new Retell account, an n8n Cloud account. Not yet: Twilio account/ISV registration, Calendar ID in config, credentials in n8n.
- Config is interim: `build-workflows.mjs` inlines `config/*.json` into the Load Business Config node. Move to an n8n Data Table once there is more than one business.
- Retell facts verified from docs search: custom function body is `{ name, call, args }`; signature header is `X-Retell-Signature`. Currently using a shared-secret header instead; consider signature verification later.

## History

Carter built one earlier attempt (a pressure washing receptionist on Retell + n8n + Google Calendar/Sheets, brand "SparkClean"). The account is down and nothing from it is active or reusable. Known lessons: a Code node that read top-level fields instead of Retell's `args`; fragile date parsing; hard-coded business details; debugging by guesswork instead of reading the failing execution. Do not carry that design forward.

## Open items

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
