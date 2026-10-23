// PASTE INTO n8n: workflow "Receptionist - Weekly Owner Report" > node "Ask For All Businesses" > Code tab (select all, replace, Save).
// Asks the Business Config workflow for every business that has the weekly report switched on.
return [{ json: { query: { business: '__all__' } } }];
