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
  else if (outcome === 'message') headline = 'Message from ' + name;
  else headline = 'Call from ' + (name !== 'Unknown caller' ? name : phone);

  var outcomeLine = {
    booked: 'Appointment booked' + (appt ? ' for ' + appt : ''),
    message: 'No booking. A message was taken - please call back.',
    urgent: 'URGENT - needs a human to follow up now. No technician has been contacted automatically.',
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

  return { subject: (urgent ? '[URGENT] ' : '') + config.businessName + ': ' + headline, body: lines.join('\n'), urgent: urgent };
}

if (typeof module !== 'undefined') module.exports = { buildSummary: buildSummary };
