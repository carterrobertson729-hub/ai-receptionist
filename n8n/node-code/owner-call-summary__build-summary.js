// PASTE INTO n8n: workflow "Receptionist - Owner Call Summary" > node "Build Summary" > Code tab (select all, replace, Save).
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
    callback: 'Callback requested (a separate callback email was sent).',
    cancelled: 'Appointment cancelled (a separate cancellation email was sent).',
    rescheduled: 'Appointment rescheduled (a separate email was sent).',
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

  // Only email calls that matter. Urgent calls always send. Otherwise send if the outcome is one the business
  // wants (default: booked, message) or the caller left real contact details (a lead worth a callback).
  var allow = (config.notifications && config.notifications.emailOutcomes) || ['booked', 'estimate', 'message', 'urgent'];
  var hasLead = name !== 'Unknown caller' && pick(custom.caller_phone, '') !== '';
  var skip = (config.notifications && config.notifications.skipOutcomes) || ['callback', 'cancelled', 'rescheduled'];   // already emailed by their own workflow
  var send = urgent || (skip.indexOf(outcome) === -1 && (allow.indexOf(outcome) !== -1 || hasLead));

  return { send: send, subject: (urgent ? '[URGENT] ' : '') + config.businessName + ': ' + headline, body: lines.join('\n'), urgent: urgent };
}


var item = $input.first().json;
var body = item.body || {};
if (body.event !== 'call_analyzed') return [];   // ignore call_started / call_ended
var CONFIGS = {"demo-plumbing":{"businessId":"demo-plumbing","businessName":"Demo Plumbing Co","trade":"plumbing","timeZone":"America/Chicago","receptionistNumber":"REPLACE_WITH_RETELL_NUMBER_E164","smsFromNumber":"REPLACE_WITH_TWILIO_NUMBER_E164","ownerPhone":"REPLACE_WITH_OWNER_NUMBER_E164","ownerEmail":"carter.robertson729@gmail.com","people":{"carter":{"name":"Carter","email":"carter.robertson729@gmail.com","phone":"REPLACE_WITH_ONCALL_NUMBER_E164"}},"onCallSchedule":{"mon":"carter","tue":"carter","wed":"carter","thu":"carter","fri":"carter","sat":"carter","sun":"carter"},"calendarId":"d8f2a8fbc0b04e3460f2971b0c7d82d953936566b3e9f560190bc3317cf2367c@group.calendar.google.com","bookingRules":{"appointmentMinutes":120,"slotStepMinutes":30,"bufferMinutes":30,"minNoticeHours":2,"maxDaysAhead":14,"maxSlotsOffered":3,"offerSpacingMinutes":60,"callbackMinNoticeMinutes":30},"hours":{"mon":["08:00","17:00"],"tue":["08:00","17:00"],"wed":["08:00","17:00"],"thu":["08:00","17:00"],"fri":["08:00","17:00"],"sat":["08:00","17:00"],"sun":["08:00","17:00"]},"services":[{"name":"Clogged toilet","durationMinutes":30,"emergency":false,"pricing":{"type":"flat","amount":50,"details":"standard clog"}},{"name":"Drain cleaning","durationMinutes":60,"emergency":false,"pricing":{"type":"flat","amount":120,"details":"one standard drain"}},{"name":"Leak repair","durationMinutes":60,"emergency":false,"pricing":{"type":"quote_on_site"}},{"name":"Faucet or fixture repair","durationMinutes":60,"emergency":false,"pricing":{"type":"quote_on_site"}},{"name":"Toilet repair or replacement","durationMinutes":90,"emergency":false,"pricing":{"type":"quote_on_site"}},{"name":"Water heater repair","durationMinutes":90,"emergency":false,"pricing":{"type":"quote_on_site"}},{"name":"Water heater replacement","durationMinutes":60,"jobMinutes":180,"emergency":false,"pricing":{"type":"big_job","startingAt":1200,"typical":"$1,800 to $3,200","estimateVisit":"a free on-site estimate visit"}},{"name":"Sewer line repair or replacement","durationMinutes":60,"emergency":false,"pricing":{"type":"big_job","startingAt":2500,"typical":"$4,000 to $12,000","estimateVisit":"a free on-site estimate visit"},"multiDay":true},{"name":"Whole-house repipe","durationMinutes":60,"emergency":false,"pricing":{"type":"big_job","startingAt":4000,"typical":"$6,000 to $15,000","estimateVisit":"a free on-site estimate visit"},"multiDay":true},{"name":"Other or not sure","durationMinutes":120,"emergency":false,"pricing":{"type":"quote_on_site"}},{"name":"Burst pipe or active flooding","emergency":true},{"name":"No water or sewage backup","emergency":true}],"fixedPrices":[],"neverSay":["Never quote a price that is not in the price list, and never estimate, round, or give a range.","Never promise an exact arrival time; offer only the booked window.","Never diagnose the problem or tell the caller how to repair it."],"languages":["en","es"],"notifications":{"emailOutcomes":["booked","estimate","message","urgent"],"skipOutcomes":["callback","cancelled","rescheduled"]},"serviceCallFee":65,"cancellationPolicy":{"freeUntilHoursBefore":24,"feeAmount":50,"estimateVisitsExempt":true,"rescheduleCountsAsCancel":false}}};
var config = CONFIGS[(item.query && item.query.business) || ''];
if (!config) throw new Error('Unknown business. Add ?business=<businessId> to the Retell webhook URL.');
var s = buildSummary(config, body);
if (!s.send) return [];   // nothing worth emailing; the call stays in Retell's history
return [{ json: { to: config.ownerEmail, subject: s.subject, body: s.body, urgent: s.urgent } }];
