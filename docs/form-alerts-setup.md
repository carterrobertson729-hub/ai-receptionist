# Get an email for every website form (without Netlify's paid email notifications)

Netlify's email notifications need a paid plan, but outgoing webhooks work on your plan (the demo booking uses one). So: Netlify sends each form to n8n, and n8n emails you.

## In n8n (once)
1. Import `n8n/website-form-alerts.json` ("Website - Form Alerts").
2. Open the **Email Me** node and pick your Gmail account. Save.
3. Open the **Build Form Email** node and find `secret:` in the SETTINGS line. That value is your key. Keep it private.
4. Switch the workflow **Active**.
5. Open the first node (**Netlify Form**) and copy its **Production URL**. It looks like `https://icrob.app.n8n.cloud/webhook/website/form-alert`.

## In Netlify (one per form: setup, order, contact, waitlist, signup)
1. Site configuration > Notifications > Form submission notifications > Add notification > **Outgoing webhook**.
2. Event: New form submission.
3. URL to notify: the Production URL followed by `?key=` and your key from step 3 above.
4. Form: pick one form. Save. Repeat for each form.
Do NOT add `demo` here. The demo form already has its own webhook.

## Test
Fill in the contact form on your site. An email "Website message from ..." should arrive within a minute. Then test the setup form.

## If nothing arrives
- n8n > Executions: did the workflow run? If not, the Netlify URL is wrong or the workflow is not Active.
- If it ran but the email step failed, re-pick the Gmail account.
- If Netlify's Forms tab shows no submission, form detection is off (redeploy with detection on).
- A wrong key makes the run stop quietly at "Worth Sending?".


## Update 2026-11-06: it also reads the customer's website
When a setup form includes a website, the workflow fetches that page (one page, public http/https addresses only, 8 second limit) and adds a "WEBSITE SCAN" block to your email: title, description, phones, emails, address guess, hours lines, prices, headings and any booking tools it links to (Square, Booksy, etc.). If the page can't be read, the email still arrives with a short note. Pages built entirely with JavaScript (many Square, Wix and booking-widget sites) give little or nothing, and the scan says so. The new workflow has extra nodes (Has Website?, Read Website, Add Website Notes), so import the new file and delete the old workflow.
