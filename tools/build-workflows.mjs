// Builds importable n8n workflow JSON into n8n/ from tested code in n8n/code/ and config/*.json.
// Run: node tools/build-workflows.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const stripExports = (t) => t.replace(/\nif \(typeof module[\s\S]*$/, '\n');
const slotsLib = stripExports(read('n8n/code/slots.js'));
const summaryLib = stripExports(read('n8n/code/summary.js'));
const oncallLib = stripExports(read('n8n/code/oncall.js'));

// INTERIM config store: every config/*.json is inlined into the Load Config node.
// Replace with an n8n Data Table lookup once more than a couple of businesses exist.
const configs = {};
for (const f of readdirSync(new URL('config/', root)).filter((f) => f.endsWith('.json'))) {
  const c = JSON.parse(read('config/' + f));
  configs[c.businessId] = c;
}

const loadConfigCode = `// Resolves which business this call is for, and reads the tool arguments.
var CONFIGS = ${JSON.stringify(configs)};
var item = $input.first().json;
var body = item.body || {};
var args = body.args || {};
var call = body.call || {};
var id = (item.query && item.query.business) || '';
var config = CONFIGS[id];
if (!config) {
  var toNumber = call.to_number || '';
  config = Object.values(CONFIGS).find(function (c) { return c.receptionistNumber === toNumber; });
}
if (!config) throw new Error('Unknown business. Add ?business=<businessId> to the tool URL.');
var now = Date.now();
var windowEnd = now + (config.bookingRules.maxDaysAhead + 1) * 86400000;
return [{ json: {
  config: config, args: args, callId: call.call_id || '',
  nowMs: now, timeMin: new Date(now).toISOString(), timeMax: new Date(windowEnd).toISOString()
} }];`;

const eventsParams = {
  resource: 'event',
  operation: 'getAll',
  calendar: { __rl: true, mode: 'id', value: '={{ $json.config.calendarId }}' },
  returnAll: false,
  limit: 250,
  timeMin: '={{ $json.timeMin }}',
  timeMax: '={{ $json.timeMax }}',
  options: { singleEvents: true, orderBy: 'startTime' }
};

const webhookNode = (path) => ({
  id: 'a1000000-0000-4000-8000-000000000001',
  name: 'Retell Tool Call',
  type: 'n8n-nodes-base.webhook',
  typeVersion: 2,
  position: [0, 0],
  webhookId: path.replace(/\//g, '-'),
  parameters: { httpMethod: 'POST', path, authentication: 'headerAuth', responseMode: 'responseNode', options: {} },
  credentials: { httpHeaderAuth: { id: 'REPLACE', name: 'Retell tool secret' } }
});

const code = (id, name, position, jsCode) => ({
  id, name, type: 'n8n-nodes-base.code', typeVersion: 2, position, parameters: { jsCode }
});

const respond = (id, position, body) => ({
  id, name: 'Respond to Retell', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position,
  parameters: { respondWith: 'json', responseBody: body, options: {} }
});

const eventsNode = (id, position) => ({
  id, name: 'Get Calendar Events', type: 'n8n-nodes-base.googleCalendar', typeVersion: 1.3, position,
  alwaysOutputData: true,
  parameters: eventsParams,
  credentials: { googleCalendarOAuth2Api: { id: 'REPLACE', name: 'Google Calendar account' } }
});

const link = (...names) => {
  const c = {};
  for (let i = 0; i < names.length - 1; i++) c[names[i]] = { main: [[{ node: names[i + 1], type: 'main', index: 0 }]] };
  return c;
};

const wf = (name, nodes, connections) => ({
  name, nodes, connections, active: false, settings: { executionOrder: 'v1' }, pinData: {}, tags: []
});

// ---------- 1. check availability ----------
const checkCompute = `${slotsLib}
var ctx = $('Load Business Config').first().json;
var events = $input.all().map(function (i) { return i.json; });
var slots = offerSlots(ctx.config, events, ctx.args, ctx.nowMs);
return [{ json: {
  slots: slots,
  message: slots.length
    ? 'Offer these times to the caller. Use the label to speak them. Pass the start value of the one they pick to book_appointment.'
    : 'No openings in the booking window. Offer to take a message so the office can call back.'
} }];`;

const check = wf('Receptionist - Check Availability', [
  webhookNode('receptionist/check-availability'),
  code('a1000000-0000-4000-8000-000000000002', 'Load Business Config', [240, 0], loadConfigCode),
  eventsNode('a1000000-0000-4000-8000-000000000003', [480, 0]),
  code('a1000000-0000-4000-8000-000000000004', 'Compute Open Slots', [720, 0], checkCompute),
  respond('a1000000-0000-4000-8000-000000000005', [960, 0], '={{ JSON.stringify($json) }}')
], link('Retell Tool Call', 'Load Business Config', 'Get Calendar Events', 'Compute Open Slots', 'Respond to Retell'));

// ---------- 2. book appointment ----------
const verifyCode = `${slotsLib}
var ctx = $('Load Business Config').first().json;
var a = ctx.args;
var events = $input.all().map(function (i) { return i.json; });

function normalizePhone(raw) {
  var d = String(raw || '').replace(/\\D/g, '');
  if (d.length === 10) d = '1' + d;
  return d.length === 11 && d.charAt(0) === '1' ? '+' + d : null;
}
var phone = normalizePhone(a.phone);
var name = String(a.name || '').trim();
var address = String(a.address || '').trim();
var problem = String(a.problem || '').trim();
var out = { status: 'invalid', reason: '' };
if (!name) out.reason = 'missing_name';
else if (!phone) out.reason = 'invalid_phone';
else if (!address) out.reason = 'missing_address';
else if (!problem) out.reason = 'missing_problem';
else if (isNaN(Date.parse(a.start))) out.reason = 'invalid_start';
else {
  var startMs = Date.parse(a.start);
  var tz = ctx.config.timeZone;
  var dup = events.some(function (e) {
    return e && e.start && e.start.dateTime && Date.parse(e.start.dateTime) === startMs &&
      String(e.description || '').indexOf(phone) !== -1;
  });
  if (dup) out = { status: 'duplicate' };
  else if (isSlotStillOpen(ctx.config, events, a.start, ctx.nowMs)) out = { status: 'open' };
  else out = { status: 'taken', alternatives: offerSlots(ctx.config, events, { preferred_date: a.start.slice(0, 10) }, ctx.nowMs) };
  var endMs = startMs + ctx.config.bookingRules.appointmentMinutes * 60000;
  out.startIso = toLocalIso(startMs, tz);
  out.endIso = toLocalIso(endMs, tz);
  out.label = friendlyLabel(startMs, tz);
}
out.phone = phone;
out.name = name;
out.address = address;
out.problem = problem;
out.service = String(a.service || 'Service visit').trim();
out.summary = out.service + ' - ' + name;
out.description = 'Booked by AI receptionist\\nCaller: ' + name + '\\nPhone: ' + phone + '\\nAddress: ' + address +
  '\\nProblem: ' + problem + '\\nSomeone on site: ' + (a.someone_on_site || 'not asked') +
  '\\nLanguage: ' + (a.language || 'en') + '\\nCall: ' + ctx.callId;
return [{ json: out }];`;

const buildResponse = `var v = $('Verify Slot').first().json;
var res;
if (v.status === 'open' || v.status === 'duplicate') {
  res = { booked: true, when: v.label, message: 'Booked for ' + v.label + '. Confirm this back to the caller. Say a confirmation text is on its way. Do not promise an exact arrival time.' };
} else if (v.status === 'taken') {
  res = { booked: false, reason: 'slot_taken', alternatives: v.alternatives, message: 'That time was just taken. Apologize briefly and offer these alternatives.' };
} else {
  res = { booked: false, reason: v.reason, message: 'Missing or invalid information (' + v.reason + '). Ask the caller for it again, then retry.' };
}
return [{ json: res }];`;

const book = wf('Receptionist - Book Appointment', [
  webhookNode('receptionist/book-appointment'),
  code('b1000000-0000-4000-8000-000000000002', 'Load Business Config', [240, 0], loadConfigCode),
  eventsNode('b1000000-0000-4000-8000-000000000003', [480, 0]),
  code('b1000000-0000-4000-8000-000000000004', 'Verify Slot', [720, 0], verifyCode),
  {
    id: 'b1000000-0000-4000-8000-000000000005', name: 'Slot Open?', type: 'n8n-nodes-base.if', typeVersion: 2.2,
    position: [960, 0],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [{ id: 'c1', leftValue: '={{ $json.status }}', rightValue: 'open', operator: { type: 'string', operation: 'equals' } }],
        combinator: 'and'
      },
      options: {}
    }
  },
  {
    id: 'b1000000-0000-4000-8000-000000000006', name: 'Create Calendar Event', type: 'n8n-nodes-base.googleCalendar',
    typeVersion: 1.3, position: [1200, -120],
    parameters: {
      resource: 'event', operation: 'create',
      calendar: { __rl: true, mode: 'id', value: "={{ $('Load Business Config').first().json.config.calendarId }}" },
      start: '={{ $json.startIso }}', end: '={{ $json.endIso }}', useDefaultReminders: true,
      additionalFields: { summary: '={{ $json.summary }}', description: '={{ $json.description }}', location: '={{ $json.address }}' }
    },
    credentials: { googleCalendarOAuth2Api: { id: 'REPLACE', name: 'Google Calendar account' } }
  },
  {
    id: 'b1000000-0000-4000-8000-000000000007', name: 'Text Confirmation', type: 'n8n-nodes-base.twilio',
    typeVersion: 1, position: [1440, -120], onError: 'continueRegularOutput',
    parameters: {
      resource: 'sms', operation: 'send',
      from: "={{ $('Load Business Config').first().json.config.smsFromNumber }}",
      to: "={{ $('Verify Slot').first().json.phone }}",
      message: "={{ $('Load Business Config').first().json.config.businessName + ': you are booked for ' + $('Verify Slot').first().json.label + ' at ' + $('Verify Slot').first().json.address + '. To change or cancel, call us back. This number is an automated assistant.' }}",
      options: {}
    },
    credentials: { twilioApi: { id: 'REPLACE', name: 'Twilio account' } }
  },
  code('b1000000-0000-4000-8000-000000000008', 'Build Response', [1680, 0], buildResponse),
  respond('b1000000-0000-4000-8000-000000000009', [1920, 0], '={{ JSON.stringify($json) }}')
], {
  ...link('Retell Tool Call', 'Load Business Config', 'Get Calendar Events', 'Verify Slot', 'Slot Open?'),
  'Slot Open?': { main: [
    [{ node: 'Create Calendar Event', type: 'main', index: 0 }],
    [{ node: 'Build Response', type: 'main', index: 0 }]
  ] },
  ...link('Create Calendar Event', 'Text Confirmation', 'Build Response', 'Respond to Retell')
});


// ---------- 3. owner call summary ----------
// No custom headers are possible on Retell's agent webhook, so the path itself is the secret.
// Rotate it by editing the Webhook node path in n8n and the Webhook URL in Retell.
const SUMMARY_PATH = 'receptionist/call-ended-4171b270b0f4e523a4d06eb7';
const summaryCode = `${summaryLib}
var item = $input.first().json;
var body = item.body || {};
if (body.event !== 'call_analyzed') return [];   // ignore call_started / call_ended
var CONFIGS = ${JSON.stringify(configs)};
var config = CONFIGS[(item.query && item.query.business) || ''];
if (!config) throw new Error('Unknown business. Add ?business=<businessId> to the Retell webhook URL.');
var s = buildSummary(config, body);
return [{ json: { to: config.ownerEmail, subject: s.subject, body: s.body, urgent: s.urgent } }];`;

const summary = wf('Receptionist - Owner Call Summary', [
  {
    id: 'c1000000-0000-4000-8000-000000000001', name: 'Retell Call Webhook', type: 'n8n-nodes-base.webhook',
    typeVersion: 2, position: [0, 0], webhookId: 'receptionist-call-ended',
    parameters: { httpMethod: 'POST', path: SUMMARY_PATH, options: {} }
  },
  code('c1000000-0000-4000-8000-000000000002', 'Build Summary', [240, 0], summaryCode),
  {
    id: 'c1000000-0000-4000-8000-000000000003', name: 'Email Owner', type: 'n8n-nodes-base.gmail',
    typeVersion: 2.1, position: [480, 0],
    parameters: {
      resource: 'message', operation: 'send', sendTo: '={{ $json.to }}', subject: '={{ $json.subject }}',
      emailType: 'text', message: '={{ $json.body }}', options: { appendAttribution: false }
    },
    credentials: { gmailOAuth2: { id: 'REPLACE', name: 'Gmail account' } }
  }
], link('Retell Call Webhook', 'Build Summary', 'Email Owner'));


// ---------- 4. urgent alert ----------
const urgentCode = `${slotsLib}
${oncallLib}
var item = $input.first().json;
var args = (item.body && item.body.args) || {};
var CONFIGS = ${JSON.stringify(configs)};
var config = CONFIGS[(item.query && item.query.business) || ''];
if (!config) throw new Error('Unknown business. Add ?business=<businessId> to the tool URL.');
var a = buildUrgentAlert(config, args, Date.now());
return a.recipients.map(function (r) {
  return { json: { to: r.email, name: r.name, role: r.role, subject: a.subject, body: a.body } };
});`;

const urgentResponse = `var sent = $('Build Alerts').all().map(function (i) { return i.json.name + ' (' + i.json.role + ')'; });
return [{ json: {
  alerted: true,
  notified: sent,
  message: 'The on-call technician and the owner have been alerted by email right now. Tell the caller that. Do not promise an arrival time or a call-back time.'
} }];`;

const urgent = wf('Receptionist - Urgent Alert', [
  webhookNode('receptionist/urgent-alert'),
  code('d1000000-0000-4000-8000-000000000002', 'Build Alerts', [240, 0], urgentCode),
  {
    id: 'd1000000-0000-4000-8000-000000000003', name: 'Email Alert', type: 'n8n-nodes-base.gmail',
    typeVersion: 2.1, position: [480, 0],
    parameters: {
      resource: 'message', operation: 'send', sendTo: '={{ $json.to }}', subject: '={{ $json.subject }}',
      emailType: 'text', message: '={{ $json.body }}', options: { appendAttribution: false }
    },
    credentials: { gmailOAuth2: { id: 'REPLACE', name: 'Gmail account' } }
  },
  code('d1000000-0000-4000-8000-000000000004', 'Build Response', [720, 0], urgentResponse),
  respond('d1000000-0000-4000-8000-000000000005', [960, 0], '={{ JSON.stringify($json) }}')
], link('Retell Tool Call', 'Build Alerts', 'Email Alert', 'Build Response', 'Respond to Retell'));

writeFileSync(new URL('n8n/check-availability.json', root), JSON.stringify(check, null, 2) + '\n');
writeFileSync(new URL('n8n/book-appointment.json', root), JSON.stringify(book, null, 2) + '\n');
writeFileSync(new URL('n8n/owner-call-summary.json', root), JSON.stringify(summary, null, 2) + '\n');
writeFileSync(new URL('n8n/urgent-alert.json', root), JSON.stringify(urgent, null, 2) + '\n');
console.log('Wrote 4 workflows: check-availability, book-appointment, owner-call-summary, urgent-alert');
