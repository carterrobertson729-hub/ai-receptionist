// Builds the owner's post-call summary from a Retell call_analyzed payload.
// Inlined into the n8n Code node by tools/build-workflows.mjs; unit-tested by tools/test-summary.mjs.

function buildSummary(config, payload) {
  var call = (payload && payload.call) || {};
  var analysis = call.call_analysis || {};
  var custom = analysis.custom_analysis_data || {};
  var tz = config.timeZone;

  function pick(v, fallback) { return v === undefined || v === null || String(v).trim() === '' ? fallback : String(v).trim(); }

  var name = pick(custom.caller_name, 'Unknown caller');
  var phone = pick(custom.caller_phone, pick(call.from_number, 'not given'));
  var address = pick(custom.address, 'not given');
  var problem = pick(custom.problem, 'not given');
  var outcome = pick(custom.outcome, 'unknown').toLowerCase();
  var appt = pick(custom.appointment_time, '');
  var urgent = custom.urgent === true || String(custom.urgent).toLowerCase() === 'true' || outcome === 'urgent';
  var summary = pick(analysis.call_summary, 'No summary was produced for this call.');

  var when = '';
  if (call.start_timestamp) {
    when = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    }).format(new Date(call.start_timestamp));
  }
  var secs = call.duration_ms ? Math.round(call.duration_ms / 1000) : 0;
  var length = secs ? Math.floor(secs / 60) + 'm ' + (secs % 60) + 's' : 'unknown';

  var headline;
  if (urgent) headline = 'URGENT call from ' + name;
  else if (outcome === 'booked') headline = 'Booked: ' + name + (appt ? ' - ' + appt : '');
  else if (outcome === 'estimate') headline = 'Estimate visit booked: ' + name + (appt ? ' - ' + appt : '');
  else if (outcome === 'message') headline = 'Message from ' + name;
  else headline = 'Call from ' + (name !== 'Unknown caller' ? name : phone);

  var outcomeLine = {
    booked: 'Appointment booked' + (appt ? ' for ' + appt : ''),
    message: 'No booking. A message was taken - please call back.',
    estimate: 'Free estimate visit booked' + (appt ? ' for ' + appt : ''),
    info: 'Information only (price or open times). The caller did not book or leave details.',
    callback: 'Callback requested (a separate callback email was sent).',
    cancelled: 'Appointment cancelled (a separate cancellation email was sent).',
    rescheduled: 'Appointment rescheduled (a separate email was sent).',
    urgent: 'URGENT - needs a human to follow up now. No technician has been contacted automatically.',
    'other/nothing': 'No booking and no details left (a hang-up, a wrong number, or nothing needed).',
    other: 'No booking and no details left (a hang-up, a wrong number, or nothing needed).',
    unknown: 'Outcome not recorded - see the summary below.'
  }[outcome] || outcome;
  if (urgent && outcome !== 'urgent') outcomeLine = 'URGENT - ' + outcomeLine + ' No technician has been contacted automatically.';

  var transcript = pick(call.transcript, '');
  if (transcript.length > 3000) transcript = transcript.slice(0, 3000) + '\n[transcript cut - see Retell for the rest]';

  var lines = [
    (urgent ? '*** URGENT ***\n' : '') + config.businessName + ' - call summary',
    '',
    'Result: ' + outcomeLine,
    'Caller: ' + name,
    'Phone: ' + phone,
    'Address: ' + address,
    'Problem: ' + problem,
    '',
    'Summary: ' + summary,
    '',
    'Call time: ' + (when || 'unknown') + ' (' + tz + ')   Length: ' + length,
    'Call ID: ' + pick(call.call_id, 'unknown')
  ];
  if (transcript) lines.push('', '--- Transcript ---', transcript);

  // Only email calls that matter. Urgent calls always send. Otherwise send if the outcome is one the business
  // wants (default: booked, message) or the caller left real contact details (a lead worth a callback).
  var allow = (config.notifications && config.notifications.emailOutcomes) || ['booked', 'estimate', 'message', 'urgent'];
  var hasLead = name !== 'Unknown caller' && pick(custom.caller_phone, '') !== '';
  var skip = (config.notifications && config.notifications.skipOutcomes) || ['callback', 'cancelled', 'rescheduled'];   // already emailed by their own workflow
  var send = urgent || (skip.indexOf(outcome) === -1 && (allow.indexOf(outcome) !== -1 || hasLead));

  return { send: send, subject: (urgent ? '[URGENT] ' : '') + config.businessName + ': ' + headline, body: lines.join('\n'), urgent: urgent,
    log: callLogRow(config, call, { name: name, phone: phone, outcome: outcome, urgent: urgent, problem: problem, secs: secs }) };
}

// One row per call for the call log sheet: local date/time, business hours vs after hours, and the outcome.
function callLogRow(config, call, f) {
  var date = '', time = '', daypart = 'Unknown', weekday = '';
  if (call.start_timestamp) {
    var parts = {};
    new Intl.DateTimeFormat('en-US', { timeZone: config.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(call.start_timestamp)).forEach(function (p) { parts[p.type] = p.value; });
    date = parts.year + '-' + parts.month + '-' + parts.day;
    time = parts.hour + ':' + parts.minute;
    weekday = parts.weekday;
    var h = (config.hours || {})[weekday.toLowerCase().slice(0, 3)];
    daypart = h && time >= h[0] && time < h[1] ? 'Business hours' : 'After hours';
  }
  var outcome = f.urgent ? 'urgent' : f.outcome;
  return {
    Date: date, Day: weekday, Time: time, 'Hours': daypart, Outcome: outcome, Urgent: f.urgent ? 'yes' : 'no',
    Name: f.name === 'Unknown caller' ? '' : f.name, Phone: f.phone === 'not given' ? '' : f.phone,
    Problem: f.problem === 'not given' ? '' : f.problem, Minutes: f.secs ? Math.round(f.secs / 6) / 10 : 0,
    'Call ID': call.call_id || ''
  };
}

if (typeof module !== 'undefined') module.exports = { buildSummary: buildSummary };
