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


var item = $input.first().json;
var body = item.body || {};
if (body.event !== 'call_analyzed') return [];   // ignore call_started / call_ended
var CONFIGS = {"demo-plumbing":{"businessId":"demo-plumbing","businessName":"Demo Plumbing Co","trade":"plumbing","timeZone":"America/Chicago","receptionistNumber":"REPLACE_WITH_RETELL_NUMBER_E164","smsFromNumber":"REPLACE_WITH_TWILIO_NUMBER_E164","ownerPhone":"REPLACE_WITH_OWNER_NUMBER_E164","ownerEmail":"carter.robertson729@gmail.com","people":{"carter":{"name":"Carter","email":"carter.robertson729@gmail.com","phone":"REPLACE_WITH_ONCALL_NUMBER_E164"}},"onCallSchedule":{"mon":"carter","tue":"carter","wed":"carter","thu":"carter","fri":"carter","sat":"carter","sun":"carter"},"calendarId":"d8f2a8fbc0b04e3460f2971b0c7d82d953936566b3e9f560190bc3317cf2367c@group.calendar.google.com","bookingRules":{"appointmentMinutes":120,"slotStepMinutes":30,"bufferMinutes":30,"minNoticeHours":2,"maxDaysAhead":14,"maxSlotsOffered":4,"offerSpacingMinutes":60,"callbackMinNoticeMinutes":30},"hours":{"mon":["08:00","17:00"],"tue":["08:00","17:00"],"wed":["08:00","17:00"],"thu":["08:00","17:00"],"fri":["08:00","17:00"],"sat":["08:00","17:00"],"sun":["08:00","17:00"]},"services":[{"name":"Clogged toilet","durationMinutes":30,"emergency":false,"pricing":{"type":"flat","amount":50,"details":"standard clog"}},{"name":"Drain cleaning","durationMinutes":60,"emergency":false,"pricing":{"type":"flat","amount":120,"details":"one standard drain"}},{"name":"Leak repair","durationMinutes":60,"emergency":false,"pricing":{"type":"quote_on_site"}},{"name":"Faucet or fixture repair","durationMinutes":60,"emergency":false,"pricing":{"type":"quote_on_site"}},{"name":"Toilet repair or replacement","durationMinutes":90,"emergency":false,"pricing":{"type":"quote_on_site"}},{"name":"Water heater repair","durationMinutes":90,"emergency":false,"pricing":{"type":"quote_on_site"}},{"name":"Water heater replacement","durationMinutes":60,"jobMinutes":180,"emergency":false,"pricing":{"type":"big_job","startingAt":1200,"typical":"$1,800 to $3,200","estimateVisit":"a free on-site estimate visit"}},{"name":"Sewer line repair or replacement","durationMinutes":60,"emergency":false,"pricing":{"type":"big_job","startingAt":2500,"typical":"$4,000 to $12,000","estimateVisit":"a free on-site estimate visit"},"multiDay":true},{"name":"Whole-house repipe","durationMinutes":60,"emergency":false,"pricing":{"type":"big_job","startingAt":4000,"typical":"$6,000 to $15,000","estimateVisit":"a free on-site estimate visit"},"multiDay":true},{"name":"Other or not sure","durationMinutes":120,"emergency":false,"pricing":{"type":"quote_on_site"}},{"name":"Burst pipe or active flooding","emergency":true},{"name":"No water or sewage backup","emergency":true}],"fixedPrices":[],"neverSay":["Never quote a price that is not in the price list, and never estimate, round, or give a range.","Never promise an exact arrival time; offer only the booked window.","Never diagnose the problem or tell the caller how to repair it."],"languages":["en","es"],"notifications":{"emailOutcomes":["booked","estimate","message","urgent"],"skipOutcomes":["callback","cancelled","rescheduled","info"]},"callLogSheetId":"1xH58TB4wd6J3q44doG8L8Hyh-wNLPok0PZNvlqBBCb0","transfer":{"enabled":false,"number":"REPLACE_WITH_OFFICE_NUMBER_E164"},"serviceCallFee":65,"cancellationPolicy":{"freeUntilHoursBefore":24,"feeAmount":50,"estimateVisitsExempt":true,"rescheduleCountsAsCancel":false,"announce":"when_applies"}},"tonic-barbershop":{"businessId":"tonic-barbershop","businessName":"Tonic Barbershop","trade":"barbershop","promptTemplate":"agent-prompt-barbershop.md","collectAddress":false,"timeZone":"America/Chicago","_TODO_CONFIRM":"Hours inferred 2026-10-15 from one weekday and one Saturday on the Square booking page (weekdays 4-6 PM, Saturday 9 AM-2 PM, Sunday and Monday closed): confirm with the shop, a weekday may open earlier with those slots already taken. Capacity is 3 barbers at once (confirmed by Carter). Time zone, phone and address are still unconfirmed. Calendar and call log sheet are set. Services, prices, durations and staff come from the Square page.","receptionistNumber":"REPLACE_WITH_RETELL_NUMBER_E164","smsFromNumber":"REPLACE_WITH_TWILIO_NUMBER_E164","ownerPhone":"REPLACE_WITH_OWNER_NUMBER_E164","ownerEmail":"carter.robertson729@gmail.com","people":{"carter":{"name":"Carter","email":"carter.robertson729@gmail.com","phone":"REPLACE_WITH_ONCALL_NUMBER_E164"}},"onCallSchedule":{"mon":"carter","tue":"carter","wed":"carter","thu":"carter","fri":"carter","sat":"carter","sun":"carter"},"calendarId":"family00131636790138753777@group.calendar.google.com","bookingRules":{"appointmentMinutes":30,"slotStepMinutes":15,"bufferMinutes":0,"minNoticeHours":1,"maxDaysAhead":14,"maxSlotsOffered":4,"offerSpacingMinutes":30,"callbackMinNoticeMinutes":30,"capacity":3},"hours":{"mon":null,"tue":["16:00","18:00"],"wed":["16:00","18:00"],"thu":["16:00","18:00"],"fri":["16:00","18:00"],"sat":["09:00","14:00"],"sun":null},"staff":[{"name":"Kayleen","role":"Stylist"},{"name":"Lauryn","role":"Stylist"},{"name":"Melissa","role":"Owner"},{"name":"Shannon","role":"Stylist"},{"name":"Stephanie","role":"Stylist"}],"services":[{"name":"Men's Haircut","durationMinutes":30,"emergency":false,"pricing":{"type":"flat","amount":27,"details":"Ages 13 to 64"}},{"name":"Boys Cut","durationMinutes":30,"emergency":false,"pricing":{"type":"flat","amount":22,"details":"Ages 12 and under"}},{"name":"Senior Cut","durationMinutes":30,"emergency":false,"pricing":{"type":"flat","amount":16,"details":"Ages 65 and older"}},{"name":"Bald Fade","durationMinutes":45,"emergency":false,"pricing":{"type":"flat","amount":30,"details":"No guard or skin fade, all ages including children"}},{"name":"Buzz Cut","durationMinutes":15,"emergency":false,"pricing":{"type":"flat","amount":20,"details":"Any cut within 2 guard numbers of each other, for example a 1 on the sides and a 2 on top"}},{"name":"Clean Up","durationMinutes":10,"emergency":false,"pricing":{"type":"flat","amount":7,"details":"Taper around ears and neckline, typically between haircuts"}},{"name":"Line-up Shave (Cheek & Neck)","durationMinutes":15,"emergency":false,"pricing":{"type":"flat","amount":10,"details":"Line-up and shave on the neck and cheek"}},{"name":"Hot Towel Shave","durationMinutes":30,"emergency":false,"pricing":{"type":"flat","amount":25,"details":"Beard trim and line-up with a hot towel neck shave, feather razor only, available with select barbers"}},{"name":"Full Head Shave","durationMinutes":30,"emergency":false,"pricing":{"type":"flat","amount":22,"details":"Whole head shave, shaper or razor"}},{"name":"Beard Trim (No Line-up)","durationMinutes":15,"emergency":false,"pricing":{"type":"flat","amount":12,"details":"Beard and mustache trim only, does not include a shave"}},{"name":"Beard Trim with Cheek and Neck Shave","durationMinutes":30,"emergency":false,"pricing":{"type":"flat","amount":22,"details":"Beard trim, line-up and shave"}},{"name":"Gray Blend","durationMinutes":15,"emergency":false,"pricing":{"type":"flat","amount":20,"details":"Men's color"}},{"name":"Scalp Massage","durationMinutes":5,"emergency":false,"pricing":{"type":"flat","amount":7,"details":"Shampoo and scalp massage with a hot towel over the eyes"}},{"name":"Eyebrow Wax","durationMinutes":15,"emergency":false,"pricing":{"type":"flat","amount":7}},{"name":"Ear Wax","durationMinutes":15,"emergency":false,"pricing":{"type":"flat","amount":7}},{"name":"Nose Wax","durationMinutes":15,"emergency":false,"pricing":{"type":"flat","amount":7}}],"fixedPrices":[],"neverSay":["Never quote a price that is not in the price list.","Never promise a specific barber; say you will note the request and the shop will do its best.","Never give hair or skin advice."],"languages":["en","es"],"notifications":{"emailOutcomes":["booked","message","urgent"],"skipOutcomes":["callback","cancelled","rescheduled","info"]},"callLogSheetId":"1yp0NSYBSyeT9cY3MnThkv-aFcXp52OZr8sXpkZhdNqI","transfer":{"enabled":false,"number":"REPLACE_WITH_OFFICE_NUMBER_E164"},"serviceGuidance":["Haircuts are by age: Boys Cut is for ages 12 and under, Men's Haircut is for ages 13 to 64, and Senior Cut is for ages 65 and older. If the caller has not said who the haircut is for, ask the age.","Bald Fade is for all ages, including children, and costs $30 for everyone. A child who wants a bald fade is the Bald Fade at $30, not the Boys Cut price.","Buzz Cut is only for cuts where the guard numbers are within 2 of each other (for example a 1 on the sides and a 2 on top). If the caller describes something different, ask one short question about what they want.","Clean Up is a quick taper around the ears and neckline, usually between haircuts. It is not a full haircut.","Beard Trim (No Line-up) is the beard and mustache trim only, and it does not include a shave. Beard Trim with Cheek and Neck Shave includes the trim, the line-up and the shave. Line-up Shave (Cheek & Neck) is a line-up and a shave on the neck and cheek.","Hot Towel Shave is a beard trim and line-up with a hot towel neck shave, feather razor only. It is available with select barbers only, so the shop confirms who.","Gray Blend is men's color. Scalp Massage is a shampoo and scalp massage with a hot towel over the eyes. These and the waxes (eyebrow, ear, nose) are quick add-ons that can go with a haircut."]}};
var config = CONFIGS[(item.query && item.query.business) || ''];
if (!config) throw new Error('Unknown business. Add ?business=<businessId> to the Retell webhook URL.');
var s = buildSummary(config, body);
return [{ json: { send: s.send, to: config.ownerEmail, subject: s.subject, body: s.body, urgent: s.urgent, log: s.log, sheetId: config.callLogSheetId || '' } }];
