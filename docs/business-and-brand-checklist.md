# Business basics, name and domain (prepared 2026-11-10)

I can't register a company, open a bank account or buy a domain for you, and I'm not a lawyer or an accountant. This is the checklist and the questions to bring to them. Do the "Before real money" items before you take your first payment from a stranger.

---

## A. Business basics

### Before real money
1. **Choose a business structure.** Many solo owners use an LLC so a lawsuit against the business can't reach personal savings. A lawyer or accountant can confirm what fits you.
2. **Register it with your state.** Search "[your state] secretary of state register LLC". (If you're in Indiana, that's the INBiz website. Check the current steps and fees.)
3. **Get a free EIN from the IRS** (irs.gov, "Apply for an EIN online"). Never pay a service for this.
4. **Open a business bank account** with the LLC papers and the EIN. Point Stripe's payouts to it. Keep business and personal money separate from day one.
5. **Finish Stripe's activation** with the business name, EIN and bank account.
6. **Get insurance quotes.** Ask about general liability, professional liability (also called errors and omissions, for when the software causes a customer loss), and cyber liability. Ask what each covers if a missed booking costs a customer money.
7. **Have a lawyer read the terms** (for one short visit): the terms of service, the privacy policy, the refund and auto-renewal wording, and the line about call recording. Rules for recording calls and for automatic renewals differ by state.

### Soon after
8. **Ask an accountant about sales tax.** Whether software subscriptions are taxable differs by state. Also ask how to track income, Stripe fees and the Retell and n8n bills.
9. **Check your reseller terms** with Retell, n8n, Google, Stripe and Twilio. Get written confirmation that you can sell the service to businesses.
10. **A simple bookkeeping setup** (a spreadsheet or a cheap tool), and a calendar reminder for quarterly estimated taxes.
11. **Local licenses.** Check with your city or county whether you need a general business license.

### Questions to ask the lawyer
- Do I need to tell callers a call is recorded, and in which states?
- Is my cancellation and refund language enforceable? Do I need a clearer auto-renewal notice?
- Do I need a customer agreement (a short contract) and a data-processing line for calls and recordings?
- Who is responsible if the receptionist books a wrong time?

---

## B. Name and domain

### What I found
I searched for an exact company named "AnswerBay" and did not find one. That is NOT a trademark check. I did find similar names in the same field: **AnswerBug** (an AI receptionist), **AnswerHero** and **Answer United**. A near-match can still cause confusion, so don't print business cards or buy ads under the name until you've checked.

### How to check a name (about 30 minutes)
1. Search the name plus "AI receptionist" and "answering service" on Google.
2. Search the US Patent and Trademark Office's free trademark search (uspto.gov) for the name and close spellings.
3. Check the domain: try the .com first. Check Instagram, Facebook and LinkedIn for the same handle.
4. Say it out loud on the phone. If you have to spell it twice, pick another name.
5. Ask a lawyer for a quick trademark opinion before you spend money on branding.

### What makes a good name here
Short, easy to say and spell, doesn't say "AI" (it dates fast), works for barbershops AND plumbers, and has a clear .com or a decent alternative.

### Ideas to test (none are checked; each needs the steps above)
PickUpPal, CallCatcher, Steady Line, Front Desk Fox, Ring Right, OpenLine Pro, Hello Shop, After Hours Ally, Lineup Line, Never Missed, Dial Dependable, Pocket Receptionist. Tell me which you like and I'll build variations. Don't treat any of these as available.

### Buying the domain
1. Buy it from a registrar you trust (Cloudflare Registrar, Namecheap, or Squarespace Domains). Expect about $10 to $20 a year for a .com. Turn on auto-renew and 2-step login.
2. Business email on the domain (for example support@yourname.com) is usually a few dollars a month through Google Workspace or a similar service.

### Connecting it (I can help step by step once you own it)
1. **Netlify:** Domain management > Add a custom domain. Netlify tells you what to change at the registrar.
2. **Firebase** (Google sign-in): add the new domain under Authentication > Settings > Authorized domains.
3. **Google sign-in screen:** add the domain to the OAuth consent screen, verify it in Google Search Console, then apply for verification so your logo and name show.
4. **Stripe:** change the public business name and support email, and rename products if needed.
5. **n8n and emails:** change the `siteUrl` in the workflows and the website links in emails.

### What I change on the site when you pick the name
Find-and-replace the name in all 21 pages, the logo text, page titles, the terms and privacy pages, the footer, the demo and onboarding emails, and the example calls ("AnswerBay" in the call cards). Then one new zip to upload.
