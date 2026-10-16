// PASTE INTO n8n: workflow "Receptionist - Book Appointment" > node "Load Business Config" > Code tab (select all, replace, Save).
// The business settings come from the central "Business Config" workflow (previous step).
var item = $input.first().json;
var body = item.body || {};
var args = body.args || {};
var call = body.call || {};
var config = item.config;
if (!config) throw new Error('Unknown business. Add ?business=<businessId> to the tool URL.');
var now = Date.now();
var windowEnd = now + (config.bookingRules.maxDaysAhead + 1) * 86400000;
return [{ json: {
  config: config, args: args, callId: call.call_id || '',
  nowMs: now, timeMin: new Date(now).toISOString(), timeMax: new Date(windowEnd).toISOString()
} }];
