# Google sign-in for the website (Firebase Authentication)

What it does: on the Log in page, a person ticks the terms box and clicks "Continue with Google". Google signs them in (it creates the account the first time). The page then shows "Welcome, name" with links to choose a plan, the setup form (name and email prefilled), the demo page, and Sign out. A record of the terms and the optional email box is sent to Netlify Forms (form `signup`), so it lands in your Netlify Forms list and your email notification.

What it does NOT do: there is no customer dashboard or password system. Billing is still Stripe's customer portal (`PORTAL_LINK` in site.js).

## Setup (about 10 minutes, free tier)
1. Go to https://console.firebase.google.com and sign in with your Google account. Click Add project, name it AnswerBay, turn Google Analytics off, create.
2. Left menu: Build > Authentication > Get started > Sign-in method > Google > Enable. Pick your email as the support email. Save.
3. Authentication > Settings > Authorized domains > Add domain: your Netlify address, for example yoursite.netlify.app (no https://). Add your own domain later when you have one.
4. Project settings (gear icon) > General > Your apps > the web icon (</>) > register an app named AnswerBay website (no hosting). It shows a firebaseConfig block with apiKey, authDomain, projectId, appId.
5. Send those four values to Claude (they are public by design, not secrets), or paste them into site.js: replace `var FIREBASE_CONFIG = null;` with `var FIREBASE_CONFIG = { apiKey: '...', authDomain: '...', projectId: '...', appId: '...' };`
6. Upload the website folder to Netlify and try it on the live address (Google sign-in does not work from a file on your computer).

## Notes
- Firebase's free plan covers sign-in at this size. Check Firebase's pricing page.
- Netlify form detection must pick up the `signup` form (redeploy once). Turn on the email notification for it (your "Any form" notification already does).
- The Firebase console > Authentication > Users page is also a list of everyone who signed in.
- Firebase web SDK version 10.12.2 is loaded from Google's CDN (gstatic.com).
- The lawyer should check the new "Accounts and sign-in" and "Emails and notifications" terms.

## Showing "AnswerBay" and the logo on Google's sign-in window (2026-10-29)

Logo files are in the website zip's companion download: `answerbay-logo-120.png` (the size Google asks for), `answerbay-logo-512.png` and `answerbay-logo.svg`. They are the same icon as the website header.

What Google shows ("Choose an account ... to continue to ...") comes from the project's OAuth consent screen, not from the website. Steps (names are from memory, the screens change):
1. Firebase console > gear icon > Project settings > General: set the Public-facing name to AnswerBay and pick a support email. Save.
2. Google Cloud console (console.cloud.google.com), pick the project `answerbay-bf6f7` at the top. Open APIs & Services > OAuth consent screen (newer layout: Google Auth Platform > Branding).
3. Fill in: App name = AnswerBay, User support email, App logo = upload `answerbay-logo-120.png`, App home page = your website address, links to your privacy policy https://endearing-macaron-e2b7a6.netlify.app/privacy.html and terms https://endearing-macaron-e2b7a6.netlify.app/terms.html (these pages exist after the website zip with `privacy.html` and `terms.html` is uploaded), developer contact email. Save.
4. Check the publishing status. If it says Testing, only people on the test-user list can sign in. Set it to In production (publish app) so any customer can.

Things to know:
- The app NAME should show as soon as it is saved. The LOGO often shows only after Google verifies the app, and verification normally needs a domain you own (a *.netlify.app address usually cannot be verified). Buying your own domain later fixes this.
- The "to continue to" text may still show the Firebase address (answerbay-bf6f7.firebaseapp.com) until the app name is set, or if a custom auth domain is not configured. A custom domain in Firebase Authentication settings can replace it.
