// PASTE INTO n8n: workflow "Receptionist - Owner Call Summary" > node "Check Usage" > Code tab (select all, replace, Save).
// Monthly minutes check for the plan a business bought. Inlined into the n8n Code node by tools/build-workflows.mjs;
// unit-tested by tools/test-usage.mjs. Works from the call log rows, so it needs no database.

function monthKey(v) {
  var s = String(v === undefined || v === null ? '' : v).trim();
  var m = s.match(/^(\d{4})-(\d{1,2})/);                 // 2026-10-09
  if (m) return m[1] + '-' + ('0' + m[2]).slice(-2);
  m = s.match(/^(\d{1,2})\/\d{1,2}\/(\d{4})/);            // 10/9/2026 (Google Sheets may reformat dates)
  if (m) return m[2] + '-' + ('0' + m[1]).slice(-2);
  return '';
}

function round1(n) { return Math.round(n * 10) / 10; }

// rows: all rows from the Calls tab. thisCall: the log row just written ({ Date, Minutes, 'Call ID' }).
function usageCheck(config, rows, thisCall) {
  var plan = config.plan;
  if (!plan || !plan.includedMinutes) return { alert: null, total: 0 };
  var month = monthKey(thisCall.Date);
  var thisId = String(thisCall['Call ID'] || '');
  var thisMin = Number(thisCall.Minutes) || 0;
  var before = 0;
  (rows || []).forEach(function (r) {
    if (monthKey(r.Date) !== month) return;
    if (thisId && String(r['Call ID'] || '') === thisId) return;   // never count this call twice
    before += Number(r.Minutes) || 0;
  });
  var total = before + thisMin;
  var limit = plan.includedMinutes;
  var warnAt = limit * (plan.warnAtPercent || 80) / 100;
  var level = null;
  if (before < limit && total >= limit) level = 'limit';          // only the call that crosses a line sends
  else if (before < warnAt && total >= warnAt && total < limit) level = 'warn';
  if (!level) return { alert: null, total: round1(total), month: month };

  var rate = plan.overagePerMinute;
  var lines = level === 'limit'
    ? [config.businessName + ' has used all ' + limit + ' included minutes for ' + month + ' (' + round1(total) + ' used).',
       '',
       rate ? 'Calls are still being answered. Minutes from here are overage at $' + rate + ' per minute.' : 'Calls are still being answered. Decide whether to bill overage or move them to a bigger plan.']
    : [config.businessName + ' has used ' + round1(total) + ' of ' + limit + ' included minutes for ' + month + ' (' + Math.round(total / limit * 100) + '%).',
       '',
       'At this pace they may hit the limit before the month ends. Good time to talk about a bigger plan.'];
  return {
    total: round1(total), month: month,
    alert: { level: level, to: config.ownerEmail, subject: (level === 'limit' ? '[LIMIT REACHED] ' : '[Usage warning] ') + config.businessName + ': ' + round1(total) + ' of ' + limit + ' minutes', body: lines.join('\n') }
  };
}


// Adds this month's minutes from the call log and emails the seller once when a plan line (80% or 100%) is crossed.
var ctx = $('Build Summary').first().json;
if (!ctx.plan) return [];
var rows = $input.all().map(function (i) { return i.json; });
var r = usageCheck({ businessName: ctx.businessName, ownerEmail: ctx.alertEmail, plan: ctx.plan }, rows, ctx.log);
if (!r.alert) return [];
return [{ json: { to: r.alert.to, subject: r.alert.subject, body: r.alert.body } }];
