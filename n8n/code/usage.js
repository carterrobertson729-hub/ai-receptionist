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
  // The friendly version for the shop owner (sent when config.shopEmail is set and plan.emailShop is not false).
  var shopAlert = null;
  if (config.shopEmail && plan.emailShop !== false) {
    var rateText = rate ? ' Extra minutes are $' + rate.toFixed(2) + ' each and are added to your next bill.' : '';
    var shopLines = level === 'limit'
      ? ['Hi,', '',
         'Your AI receptionist has now used all ' + limit + ' minutes included in your ' + (plan.name ? plan.name + ' ' : '') + 'plan this month (' + round1(total) + ' used).', '',
         'Nothing changes for your callers: the receptionist keeps answering every call.' + rateText,
         'If you are going over most months, moving to the next plan up is usually cheaper. Just reply to this email and we will set it up.']
      : ['Hi,', '',
         'A quick heads-up: your AI receptionist has used ' + round1(total) + ' of the ' + limit + ' minutes in your ' + (plan.name ? plan.name + ' ' : '') + 'plan this month (' + Math.round(total / limit * 100) + '%).', '',
         'Nothing to do right now. Calls keep being answered either way.' + rateText,
         'If you expect a busy rest of the month, reply to this email and we can look at the next plan up.'];
    shopAlert = { level: level, to: config.shopEmail, subject: 'Your AI receptionist: ' + round1(total) + ' of ' + limit + ' minutes used this month', body: shopLines.join('\n') };
  }
  return {
    total: round1(total), month: month, shopAlert: shopAlert,
    alert: { level: level, to: config.ownerEmail, subject: (level === 'limit' ? '[LIMIT REACHED] ' : '[Usage warning] ') + config.businessName + ': ' + round1(total) + ' of ' + limit + ' minutes', body: lines.join('\n') }
  };
}

if (typeof module !== 'undefined') module.exports = { usageCheck: usageCheck, monthKey: monthKey };
