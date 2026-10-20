# How a shop connects its phone: three setups

Every shop keeps its existing phone number. What changes is who answers first.

## Setup 1: Staff first, AI as backup (default, `answerMode: "backup"`)
- Customers call the shop's usual number. The staff answer if they can.
- If nobody picks up (after about 4 rings), or the shop is closed, the carrier forwards the call to the AI's Retell number.
- How: the shop turns on "forward when no answer / busy / after hours" (conditional forwarding) with its carrier, pointing at the Retell number.
- The AI opens with "Thanks for calling X. The office can't take your call right now, but I can help you get scheduled."
- Transfer to a human is optional here. The call already rang the staff.

## Setup 2: AI answers everything, 24/7 (`answerMode: "main_line"`)
- The AI picks up every call. During open hours, if the caller asks for a person, the AI transfers the call to the shop. If nobody at the shop picks up, the AI comes back and says nobody is available, offers to book, mentions the website and walk-ins, takes a message or sets up a callback. Outside hours it says the shop is closed and offers to book, take a message or set up a callback.
- How: EITHER the shop forwards ALL calls (unconditional forwarding) to the Retell number, OR the shop publishes the Retell number as its main number, OR (later, bigger step) the shop's number is ported to the phone provider.
- The AI opens with "Thanks for calling X. How can I help you today?"
- Needs the transfer feature (Retell tool `transfer_to_office`, warm transfer; see docs/transfer-setup.md) and a Retell phone number.

### IMPORTANT for Setup 2: the transfer number must be DIFFERENT
If the shop forwards all calls to the AI, and the AI transfers to the shop's main number, the call loops back into the AI. The transfer destination must be a number that does not forward to the AI: a direct line, the owner's cell, or a ring group of the staff's phones. Ask the shop for that number during setup.

## Setup 3: Staff first, then AI (same as Setup 1)
Staff phones ring first. If nobody answers, the AI takes over. After hours the AI answers. This is conditional forwarding with a ring count; the owner chooses the ring count (about 4 rings is a good start).

## What changes in Claude's files for each shop
- `answerMode`: "backup" or "main_line" (changes the opening line).
- `transfer.enabled`, `transfer.number` (the different number to ring), `transfer.ringSeconds`.
- Everything else stays the same.

## Test for each shop before going live
1. Call the shop's number from another phone and follow the whole path (does it ring the staff, does it forward, does the right business answer).
2. Ask for a person during open hours; answer the transfer once; then call again and do NOT answer to hear the AI come back.
3. Call after hours (or change the hours on a test copy).
4. Check caller ID: does the AI see the real caller's number or the shop's? (Carriers differ.)
5. Check that forwarded minutes are not billed oddly by the shop's carrier.

## Things to ask the shop
- Who should answer first, staff or the AI?
- After how many rings should the AI take over (setup 1 or 3)?
- What number should a transfer ring (a number that does NOT forward to the AI)?
- What is the shop's phone service (cell, landline, VoIP system)? That decides how forwarding is turned on.
