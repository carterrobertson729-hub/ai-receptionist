# Twilio texting approval: plan (checked 2026-10-12)

Why: confirmation texts, payment links and on-call paging all need Twilio texting. US carriers block unregistered business texting, and approval takes days to weeks, so start early.

## What Twilio's docs say (ISV route)
1. Your own account needs an approved **Primary Business Profile** (Trust Hub in the Twilio Console, business type "ISV Reseller or Partner").
2. Each customer business gets its own **Secondary Customer Profile**, then its own **Brand** (reviewed by The Campaign Registry) and a **Campaign** (the use case: appointment confirmations and alerts).
3. Sole proprietors (no tax ID) use a separate, simpler sole-proprietor brand: one brand = one campaign.
4. Toll-free numbers are an alternative with their own verification (a blog estimates 5 to 15 business days; unverified toll-free texts are blocked). Twilio points small businesses without a tax ID to the sole-proprietor 10DLC route.
Docs: https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/onboarding-isv-api and https://www.twilio.com/docs/sms/a2p-10dlc/isv-api-registration-overview
Unverified: current approval times and fees. Read them in the Twilio Console before paying.

## Carter's to-do (now)
- Create a Twilio account and upgrade it (trial accounts cannot register).
- Gather: legal business name, address, EIN (or confirm he has none), website, a contact email and phone, and who the authorized representative is.
- Decide: is Carter selling through a registered business? The Primary Business Profile needs a real business identity.
- Ask Twilio support/sales in writing whether reselling an AI receptionist that sends appointment texts for customers is allowed under the ISV program.

## Then (Claude)
- Re-enable the Text Confirmation node, restore the prompt line about texts, add SMS paging with acknowledgement and escalation, and send the owner summary by text.
