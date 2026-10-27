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
