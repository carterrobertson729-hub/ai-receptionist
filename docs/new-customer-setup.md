# New customer setup sheet (one page)

## How the pieces connect
```
Customer dials the SHOP'S number (unchanged on website, Google, signs)
   | (1) owner's call-forwarding setting at their phone company
Your Retell number
   | (2) you attach the number to the shop's agent in Retell (inbound agent)
The shop's agent (own prompt, own functions)
   | (3) each function address ends in ?business=<shop-id>
Your n8n workflows -> "Receptionist - Business Config" picks the shop's settings
   | (4) the settings point to the shop's calendar ID, call log sheet ID, owner email
The shop's Google Calendar, call log sheet, emails
```
Nothing is added to the shop's website. The AI number is never published; it only appears in the forwarding setting.

## From the owner
- [ ] Questionnaire answers (docs/customer-setup-questionnaire.md), including section 9b (who answers first, rings, transfer number, phone service, website booking)
- [ ] Their Google Calendar shared with your Google account (permission to make changes), plus its Calendar ID
- [ ] The number a transfer should ring (must NOT forward to the AI)
- [ ] Permission/time for the forwarding setup (docs/phone-setup-modes.md)

## You do
- [ ] Ask Claude to create config/<shop-id>.json, then generate the prompt, Retell function list, and workflow files
- [ ] Paste the new settings into n8n: Receptionist - Business Config > Find Business (one box)
- [ ] Make the shop's call log Google Sheet (tab Calls, 11 headings) and put its ID in the settings
- [ ] Retell: new agent (not a copy that keeps another business's prompt/functions), paste prompt, add functions from retell/<shop-id>-tools.json with the X-Receptionist-Secret header, set the call-finished webhook, set post-call analysis fields, set language
- [ ] Buy the Retell number and set its inbound agent to this shop's agent
- [ ] Add the transfer tool (if the shop wants transfers) and paste the transfer-on prompt
- [ ] Forwarding turned on (owner, with you on a call)
- [ ] Test through the shop's real number: booking, cancel/reschedule, transfer answered and not answered, after hours, call log row, summary email

## If something is off
- Call never reaches the AI: forwarding
- Wrong business answers: the number's inbound agent, or the agent's prompt
- "Can't check times": function addresses (?business=) or password header
- Booked but no calendar event: calendar ID / calendar sharing
- Email for the wrong business: webhook missing ?business=
