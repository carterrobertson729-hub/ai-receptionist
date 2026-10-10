// Builds the "callback requested" email for the office. Inlined into an n8n Code node; unit-tested by tools/test-callback.mjs.

function buildCallbackEmail(config, args, nowMs) {
  function clean(v, fallback) {
    var t = v === undefined || v === null ? '' : String(v).replace(/[\r\n]+/g, ' ').trim();
    return t ? t.slice(0, 500) : fallback;
  }
  var name = clean(args.name, 'Unknown caller');
  var phone = clean(args.phone, 'not given');
  var address = clean(args.address, 'not given');
  var service = clean(args.service, 'Job');
  var problem = clean(args.problem, 'not given');
  var when = clean(args.preferred_callback_time, 'as soon as possible');
  var priceInfo = clean(args.price_discussed, 'none');
  var called = new Intl.DateTimeFormat('en-US', {
    timeZone: config.timeZone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  }).format(new Date(nowMs));
  var body = [
    'CALLBACK REQUESTED - ' + service,
    '',
    'Caller: ' + name,
    'Phone: ' + phone,
    'Address: ' + address,
    'Job: ' + service,
    'Details: ' + problem,
    'Best time to call back: ' + when,
    'Price information the caller was given: ' + priceInfo,
    'Requested: ' + called + ' (' + config.timeZone + ')',
    '',
    'The caller was told the office will call them back. No appointment has been booked.'
  ].join('\n');
  var to = config.callbackEmail || config.ownerEmail;
  return { to: to, subject: config.businessName + ': Callback requested - ' + service + ' - ' + name, body: body };
}

if (typeof module !== 'undefined') module.exports = { buildCallbackEmail: buildCallbackEmail };
