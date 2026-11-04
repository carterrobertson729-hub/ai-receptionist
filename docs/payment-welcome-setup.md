# Automatic "here are your questions" email after a customer pays

What it does: when Stripe records a paid checkout, n8n (1) emails the CUSTOMER a thank-you with their setup-form link (their plan, name and email already filled in) and what happens next, and (2) emails YOU "PAID: name - amount (plan)". When they send the setup form, you get the "NEW SETUP FORM" email from the form-alerts workflow.

## In n8n (once)
1. Import `website-payment-welcome.json` ("Website - Payment Welcome").
2. Open **Send Email** and pick your Gmail account. Save.
3. Open **Build Welcome Emails** and find `secret:` in the SETTINGS. That is your key. Keep it private.
4. Switch the workflow **Active**, then open the first node (**Stripe Payment**) and copy its **Production URL**.

## In Stripe (do it in TEST mode first)
1. Developers > Webhooks > Add endpoint.
2. Endpoint URL: the Production URL, then `?key=` and your key.
3. Events to send: only `checkout.session.completed`.
4. Save. Stripe test mode and live mode have separate webhooks, so repeat this in live mode when you go live.

## Test (Stripe test mode)
1. Open one of your test payment links and pay with the test card 4242 4242 4242 4242 (any future date, any code).
2. Within a minute you should get a "[TEST] PAID: ..." email, and the email you typed at checkout should get the welcome email with the setup link.
3. Open the link: the setup form should open with name and email filled in.

## Also still do (instant, works even if n8n is down)
In each Stripe payment link: After payment > Don't show confirmation page > redirect to `https://endearing-macaron-e2b7a6.netlify.app/setup.html`. And add the $99 setup fee as a second item on each link.

## Notes
- The plan guess comes from the amount paid. Add-ons, tax or coupons can change the amount, so it may say "cannot tell". The link still works.
- If Stripe shows the webhook failing, check n8n Executions. A wrong key stops quietly.
- Duplicate emails are possible if Stripe retries. Stripe retries only if n8n answers with an error.
- Keep the plan list in the Build Welcome Emails node in step with `PLANS` in `website/site.js` if prices change.
