// Who gets alerted for an urgent call, and what the alert says.
// Needs slots.js helpers (weekdayKey, localDateStr) inlined before it. Unit-tested by tools/test-oncall.mjs.

function resolveRecipients(config, nowMs) {
  var day = weekdayKey(localDateStr(nowMs, config.timeZone));
  var out = [];
  var seen = {};
  function add(p, role) {
    if (!p || !p.email) return;
    var k = String(p.email).toLowerCase();
    if (seen[k]) return;
    seen[k] = true;
    out.push({ name: p.name || role, email: p.email, phone: p.phone || '', role: role });
  }
  var key = config.onCallSchedule && config.onCallSchedule[day];
  add(config.people && config.people[key], 'on-call');
  add({ name: 'Owner', email: config.ownerEmail, phone: config.ownerPhone }, 'owner');
  return out;
}

function buildUrgentAlert(config, args, nowMs) {
  function clean(v, fallback) {
    var s = v === undefined || v === null ? '' : String(v).replace(/[\r\n]+/g, ' ').trim();
    return s ? s.slice(0, 500) : fallback;
  }
  var name = clean(args.name, 'Unknown caller');
  var phone = clean(args.phone, 'not given');
  var address = clean(args.address, 'not given');
  var problem = clean(args.problem, 'not given');
  var onSite = clean(args.someone_on_site, 'not asked');
  var safety = args.safety_issue === true || String(args.safety_issue).toLowerCase() === 'true';
  var when = new Intl.DateTimeFormat('en-US', {
    timeZone: config.timeZone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  }).format(new Date(nowMs));

  var recipients = resolveRecipients(config, nowMs);
  var subject = '[URGENT] ' + config.businessName + ': ' + problem.slice(0, 60) + ' at ' + address.slice(0, 60);
  var body = [
    '*** URGENT CALL - PLEASE CALL BACK NOW ***',
    safety ? 'SAFETY ISSUE REPORTED (gas, smoke, sparks, flooding near electrics, or danger). The caller was told to get out and call 911 / the utility.' : '',
    '',
    'Caller: ' + name,
    'Phone: ' + phone,
    'Address: ' + address,
    'Problem: ' + problem,
    'Someone at the property: ' + onSite,
    'Call time: ' + when + ' (' + config.timeZone + ')',
    '',
    'The caller was told this was sent to the on-call technician and that no arrival time can be promised.',
    'Sent to: ' + recipients.map(function (r) { return r.name + ' (' + r.role + ')'; }).join(', ')
  ].filter(function (l, i) { return l !== '' || i !== 1; }).join('\n');

  return { recipients: recipients, subject: subject, body: body };
}

if (typeof module !== 'undefined') module.exports = { resolveRecipients: resolveRecipients, buildUrgentAlert: buildUrgentAlert };
