// PASTE INTO n8n: workflow "Receptionist - Owner Call Summary" > node "Prepare Log Row" > Code tab (select all, replace, Save).
// One row per call; the keys here must match the column headers in row 1 of the Calls tab.
return [{ json: $input.first().json.log }];
