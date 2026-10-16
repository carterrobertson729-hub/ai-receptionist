# Transfer to a human: setup and test (do this when you have a Retell phone number)

## What it does
The AI answers every call. Only if the caller asks for a person, a manager or a specific employee, AND the shop is open, it says "Sure, let me try to connect you" and rings the shop's real number. If nobody picks up, the AI stays on the line and keeps helping (book, message or callback). Outside open hours it says the shop is closed and offers to finish the call, take a message, or set up a callback. It never transfers emergencies (plumbing).

## Status
Built in the prompt and settings, switched OFF (`config.transfer.enabled: false`). It does nothing until you add the tool in Retell and paste the transfer-ON prompt.

## What you need
1. A Retell phone number (about $2 a month) attached to the agent. Web calls cannot transfer.
2. The real number to ring (the shop's phone or the owner's cell), in +1 format, for example +15551234567.

## Steps in Retell (buttons may be named slightly differently; send me a screenshot if you cannot find one)
1. Open the agent (Tonic Barbershop).
2. In the tools / functions area, click Add, and choose Transfer Call (a built-in tool, not a custom function).
3. Name it exactly `transfer_to_office`.
4. Destination: the number to ring.
5. Transfer type: choose WARM transfer (the AI stays on the line while it rings), not cold.
6. Ring / no-answer timeout: about 20 seconds if there is a setting for it.
7. Save.
8. Replace the agent's prompt with `retell/<businessId>-prompt-transfer.txt` (the transfer-ON version; Claude generates it with `node tools/build-prompt.mjs --with-transfer`).

## Test (5 minutes, from a different phone than the one that will ring)
1. Call the Retell number. Say "Can I talk to a person?" during open hours. The destination phone should ring.
2. Do not answer. The AI should come back, say nobody is available, and offer to take a message or book.
3. Call again, answer the ringing phone, and confirm you can talk to the caller.
4. Call outside open hours (or change the hours on a test copy). The AI should say the shop is closed and offer the three choices.
5. In the plumbing agent: say "my pipe burst" then "let me talk to someone". It should still use the urgent steps, not transfer.

## Known risks (from Retell's forum, not tested by us)
- One bug report: after an early failure the AI was never resumed and the caller heard hold music until hanging up. That is why you must test the no-answer case before using this with a real customer.
- If the AI goes silent after a failed transfer, tell Claude; the fallback is to remove transfer and use callbacks.

## For a barbershop
Barbers are busy cutting hair and may not pick up. Callbacks and messages may be better; offer transfer only if the owner wants it.
