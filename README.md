# AI Receptionist — setup (milestone 1: check availability and book)

What works after these steps: you talk to a Retell test agent, it checks your Google Calendar, books a visit, and (once Twilio texting is approved) texts a confirmation.

Files: `config/` (one JSON per business), `n8n/` (workflows to import), `retell/` (prompt and tool definitions), `tools/` (build and test scripts). The n8n workflows are generated: edit `n8n/code/slots.js` or `config/*.json`, then run `node tools/build-workflows.mjs`. Run `node tools/test-slots.mjs` to test the scheduling logic.

**Status: the workflows have never been run inside n8n.** The scheduling logic and Code-node scripts are tested; the n8n node settings (especially the Google Calendar and Twilio nodes) must be checked after import. Expect small fixes.

## 1. Google Calendar
1. In Google Calendar, open the new demo calendar: Settings > the calendar > Integrate calendar > copy the **Calendar ID**.
2. Paste it into `config/demo-plumbing.json` as `calendarId`. Also set your real `timeZone`, and add a few test events.

## 2. n8n
1. Create a credential: Credentials > New > **Header Auth**. Name: `Retell tool secret`. Header name: `X-Receptionist-Secret`. Value: a long random password (save it).
2. Create credentials for **Google Calendar OAuth2** and (later) **Twilio**.
3. Import both files in `n8n/`: Workflows > Import from File. Open each node with a warning icon and pick the credential you made.
4. Open the **Get Calendar Events** and **Create Calendar Event** nodes and check the fields match what is described in `n8n/` (calendar, after/before times, start, end). If n8n's field names differ in your version, tell me what you see.
5. Activate both workflows. Copy each **Production URL** from the Webhook node.

## 3. Retell
1. Create an agent. Paste the prompt from `retell/agent-prompt.md` (fill in the `{{...}}` values).
2. Add the two custom functions from `retell/tools.json`, using your n8n URLs and the header `X-Receptionist-Secret`.
3. Test with the web call button first (no phone number needed).

## Do not yet
- Do not forward a real business line to this. Emergency dispatch, human transfer, and owner summaries are the next milestones.
- Texting at volume needs Twilio A2P 10DLC approval; start the ISV registration now.

## Updating a live workflow without re-importing

Most changes only touch the code inside one or two nodes. `node tools/build-workflows.mjs` writes each Code node's script to `n8n/node-code/<workflow>__<node>.js`. To apply a change: open that workflow in n8n, click the named node, open the Code tab, select all, paste the file's contents, Save. Credentials, webhook URLs, and the deactivated Twilio node are untouched. Re-import a whole workflow only when nodes are added, removed, or re-wired (the release notes say when).

Business facts (hours, prices, job types) are currently embedded in the Load Business Config / Build Summary / Build Alerts / Build Callback Email nodes, so a facts change means pasting into each of those. Planned fix: one central config workflow that the others read.
