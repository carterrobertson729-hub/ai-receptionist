// Generates retell/<businessId>-prompt.txt from retell/agent-prompt.md (the template) and config/<businessId>.json.
// Run: node tools/build-prompt.mjs [businessId]   (default: every config/*.json)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const loadTemplate = (file) => read('retell/' + file).split('\n---\n')[1].trim();
const template = loadTemplate('agent-prompt.md');

const DAYS = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']];
const clock = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; const h12 = h % 12 || 12; return h12 + (m ? ':' + String(m).padStart(2, '0') : '') + ' ' + ap; };

export function bookingHours(hours) {
  const segs = [];
  for (const [k, name] of DAYS) {
    const h = hours[k] ? clock(hours[k][0]) + ' to ' + clock(hours[k][1]) : null;
    const last = segs[segs.length - 1];
    if (last && last.h === h) last.days.push(name); else segs.push({ h, days: [name] });
  }
  const open = segs.filter((s) => s.h);
  const closed = segs.filter((s) => !s.h).flatMap((s) => s.days);
  const span = (d) => d.length === 7 ? 'Every day of the week' : d.length === 1 ? d[0] : d[0] + ' through ' + d[d.length - 1];
  let out = open.map((s) => span(s.days) + ', ' + s.h).join('; ');
  if (closed.length) out += '. The office is closed ' + closed.join(' and ');
  return out;
}

export function priceList(config) {
  const fee = config.serviceCallFee;
  return config.services.filter((s) => !s.emergency).map((s) => {
    const p = s.pricing || { type: 'quote_on_site' };
    if (p.type === 'flat') return `- ${s.name}: flat price of $${p.amount}${p.details ? ' (' + p.details + ')' : ''}. State this price.`;
    if (p.type === 'big_job') {
      const range = p.typical ? `These typically run ${p.typical}, and they start around $${Number(p.startingAt).toLocaleString('en-US')}, depending on the setup.` : `These start around $${Number(p.startingAt).toLocaleString('en-US')}, depending on the setup.`;
      const jobHrs = s.jobMinutes ? Math.round(s.jobMinutes / 6) / 10 : null;
      const est = `${p.estimateVisit || 'an on-site estimate visit'} first, a short visit (about ${s.durationMinutes || 60} minutes) so they get an exact price, and the job is scheduled afterward by the office`;
      const common = `BIG JOB. Never give an exact price. If the caller asks what it costs (an average, a ballpark, or the lowest price), you may say ONLY this, as an estimate and not a quote: "${range}" Then say the technician gives an exact price after seeing the job. Do NOT decide for the caller.`;
      if (s.multiDay) return `- ${s.name}: ${common} This job usually takes more than one day, so you NEVER book the job itself. Ask which they would like: (B) ${est}; or (C) have the office call them back at a time they choose. They may also decline both. For (B) pass visit_type "estimate" to check_availability and book_appointment; for (C) follow the callback steps below. Never pick for the caller.`;
      return `- ${s.name}: ${common} Ask which they would like: (A) book the job now, which reserves a longer window${jobHrs ? ' (about ' + jobHrs + ' hours)' : ''} and the technician confirms the exact price on site before any work starts; (B) ${est}; or (C) have the office call them back at a time they choose. They may also decline all of these. For (A) pass visit_type "job" to check_availability and book_appointment; for (B) pass visit_type "estimate" to both; for (C) follow the callback steps below, and put the price information you gave in price_discussed. Never pick (A), (B) or (C) for the caller.`;
    }
    if (p.type === 'callback') return `- ${s.name}: do NOT quote a price and do NOT check availability or book. Say pricing for this job is custom, take the caller's name, phone number, address and a short description, and tell them someone from the office will call them back to go over it.`;
    return `- ${s.name}: no fixed price. ${fee ? 'Say there is a $' + fee + ' service call fee, and that ' : 'Say that '}the technician gives an exact price on site before any work starts. Book the visit as usual.`;
  }).join('\n');
}

export function cancellationPolicyText(config) {
  const p = config.cancellationPolicy;
  if (!p || !p.feeAmount) return 'No cancellation policy is on file. Never mention or invent a cancellation fee. If the caller asks about fees, say the office can answer that.';
  const ask = p.announce === 'only_if_asked' ? 'Do not bring fees up yourself; only explain the policy if the caller asks.' : 'When a fee applies to the appointment, tell the caller plainly before they confirm.';
  return `Cancellation policy on file: free to cancel until ${p.freeUntilHoursBefore} hours before the visit; after that there is a $${p.feeAmount} late cancellation fee${p.estimateVisitsExempt !== false ? ' (free estimate visits are exempt)' : ''}${p.rescheduleCountsAsCancel ? '; moving a visit this close to the time counts the same as cancelling' : '; moving a visit to a new time does not carry a fee'}. ${ask} You never charge anything. For each appointment, the lookup result says whether the fee applies (cancellation.feeApplies).`;
}

export function transferText(config) {
  const t = config.transfer;
  const closed = 'Say the office is closed right now, and offer three choices: you can finish helping them now (booking a visit), take a message, or set up a callback with the office (use the callback steps in the Pricing section). Do not transfer.';
  if (!t || !t.enabled) return `If the caller asks for a person, a manager, or a specific employee, do not transfer. Say nobody is available to take the call right now, and offer to finish helping them now, take a message, or set up a callback with the office (use the callback steps in the Pricing section).`;
  return `Never offer a transfer yourself. You are the one answering, and you handle the call unless the caller asks for a person, a manager, or a specific employee. Only then:
- Office hours are: ${bookingHours(t.hours || config.hours)}. Check the current time shown at the top of this prompt.
- During office hours: say "Sure, let me try to connect you," then call the transfer tool \`transfer_to_office\`. If the transfer does not connect (nobody picks up, busy, or an error), you are still on the line: say something like "Looks like nobody is available right at the moment, but I can still take care of this for you," and carry on helping them (book the visit, take a message, or set up a callback) until the conversation is finished. Do not try to transfer again unless they insist, and then try only once more.
- Outside office hours: ${closed}
- Never transfer an emergency or safety call. Handle it with the urgent steps instead, unless the caller has been told someone was alerted and still asks for a person.`;
}

export function staffList(config) {
  return (config.staff || []).map((m) => m.name + (m.role ? ' (' + m.role + ')' : '')).join(', ') || 'Ask the shop for the team.';
}

export function build(config) {
  const routine = config.services.filter((s) => !s.emergency).map((s) => s.name).join(', ');
  const vars = {
    business_name: config.businessName, trade: config.trade, time_zone: config.timeZone,
    services_list: routine, booking_hours: bookingHours(config.hours),
    extra_never_say: (config.neverSay || []).join(' '), price_list: priceList(config), cancellation_policy: cancellationPolicyText(config), transfer_policy: transferText(config), staff_list: staffList(config),
    shop_facts: (config.shopFacts || []).map((l) => '- ' + l).join('\n') || '- None.',
    service_guidance: (config.serviceGuidance || []).map((l) => '- ' + l).join('\n') || '- None.'
  };
  let out = (config.promptTemplate ? loadTemplate(config.promptTemplate) : template).replace(/\{\{current_time_<[^}]*>\}\}/, `{{current_time_${config.timeZone}}}`);
  for (const [k, v] of Object.entries(vars)) out = out.split(`{{${k}}}`).join(v);
  const left = out.match(/\{\{(?!current_time_)[^}]*\}\}/g);
  if (left) throw new Error('Unfilled placeholders: ' + left.join(', '));
  return out + '\n';
}

if (process.argv[1] && process.argv[1].endsWith('build-prompt.mjs')) {
  const only = process.argv[2];
  for (const f of readdirSync(new URL('config/', root)).filter((f) => f.endsWith('.json'))) {
    const c = JSON.parse(read('config/' + f));
    if (only && c.businessId !== only) continue;
    writeFileSync(new URL(`retell/${c.businessId}-prompt.txt`, root), build(c));
    console.log(`Wrote retell/${c.businessId}-prompt.txt`);
  }
}
