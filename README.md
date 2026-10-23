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

## Call log sheet (day vs night counts)

Every analyzed call adds one row to a Google Sheet tab named `Calls` (workflow "Owner Call Summary", node "Log Call"). Row 1 headers, exactly: `Date, Day, Time, Hours, Outcome, Urgent, Name, Phone, Problem, Minutes, Call ID`. The sheet ID (the long text between `/d/` and `/edit` in its URL) goes in `config/<id>.json` as `callLogSheetId`, then rebuild. `Hours` is `Business hours` or `After hours`, decided from the config hours in the business time zone.

Add a second tab named `Report` with these formulas for the counts:

- Calls during business hours: `=COUNTIF(Calls!D:D,"Business hours")`; after hours: `=COUNTIF(Calls!D:D,"After hours")`
- Booked after hours: `=COUNTIFS(Calls!D:D,"After hours",Calls!E:E,"booked")` (swap `booked` for `estimate`, `callback`, `message`, `urgent`, `cancelled`, `rescheduled`)
- Calls today: `=COUNTIF(Calls!A:A,TEXT(TODAY(),"yyyy-mm-dd"))`

## Adding a new business (central settings)

All business settings live in ONE n8n workflow, "Receptionist - Business Config" (node "Find Business"). Every other workflow asks it for the settings through a "Get Business Config" node, using the `?business=<id>` ending on the address. So a new business needs NO new workflows:

1. Get their answers (docs/customer-setup-questionnaire.md) and ask Claude to create `config/<id>.json` and generate their prompt (`node tools/build-prompt.mjs`) and Retell function list (`node tools/build-tools.mjs`).
2. Run `node tools/build-workflows.mjs`. Open `n8n/node-code/business-config__find-business.js`, copy all of it.
3. In n8n open "Receptionist - Business Config" > node "Find Business" > replace the code > Save. (The other 8 workflows do not change.)
4. In Retell: duplicate an agent, paste the new prompt, add the tools from `retell/<id>-tools.json` (addresses end in `?business=<id>`), set the call-finished webhook to end in `?business=<id>`, attach the phone number.
5. Create their Google Calendar (shared with your Google account) and a call-log sheet (tab `Calls`, 11 headings), and put the IDs in their config before step 2.

First-time setup: import "Receptionist - Business Config" first, then import the others and, in each, open "Get Business Config" and pick "Receptionist - Business Config" as the workflow to run.

## Weekly owner report

Import `n8n/weekly-owner-report.json`, pick the Google Sheets and Gmail credentials, open `Get Business Config` and choose `Receptionist - Business Config`, set the workflow timezone (Workflow Settings > Timezone) to the shop's, then activate. It emails each business with `weeklyReport.enabled` every Monday 8:00 about the previous Monday-Sunday. To test now, click Execute workflow (it sends real emails). The Business Config workflow's Find Business code must be the latest version (it understands `__all__`).
