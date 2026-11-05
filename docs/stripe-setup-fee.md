# Charging the one-time $99 setup fee (Stripe payment links)

Problem found 2026-11-05: a test purchase charged only the plan price. The 14 payment links have one item (the plan). The $99 setup fee is a separate one-time price that has to be added to each link as a second item. A subscription link can hold a recurring item plus a one-time item. The one-time item is charged with the first payment only.

## Do ONE link first and test it
1. Stripe > Product catalog: you should already have a product for the setup fee with a ONE-TIME price of $99. If not, add one (name "Setup fee", price $99, one time).
2. Stripe > Payment links > open one plan link (for example Backup Standard monthly) > Edit.
3. Look for the products list. Click Add product, pick the Setup fee, quantity 1. Save.
   - If the products can NOT be changed on an existing link: use Duplicate (or Create payment link) and add BOTH the plan and the Setup fee. Then you have a new link URL.
4. Under After payment: Don't show confirmation page, redirect to `https://endearing-macaron-e2b7a6.netlify.app/payment-thanks.html`.
5. Test: open the link. The checkout should list the plan with its recurring price AND the setup fee, and show a first total of plan + $99 (Backup Standard monthly = $188, then $89 a month).
6. In the setup welcome email to you, the amount will be the first total and the plan guess says "(setup fee included)".

## The links to do (7 plans x monthly and yearly)
Backup Lite, Backup Standard, Backup Plus, 24/7 Starter, 24/7 Standard, 24/7 Plus, 24/7 High volume. Yearly links charge the yearly price + $99 once.

## If you made new links
Paste the new URLs to Claude. They go in `CHECKOUT_LINKS` in `website/site.js`, then upload a new site zip.

## Add-ons
A payment link covers only the plan and the setup fee. Spanish and Extra number are added by hand in Stripe after payment (add a second subscription item).
