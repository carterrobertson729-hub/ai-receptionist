// Generates retell/<businessId>-prompt.txt from retell/agent-prompt.md (the template) and config/<businessId>.json.
// Run: node tools/build-prompt.mjs [businessId]   (default: every config/*.json)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const template = read('retell/agent-prompt.md').split('\n---\n')[1].trim();

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
    if (p.type === 'callback') return `- ${s.name}: do NOT quote a price and do NOT check availability or book. Say pricing for this job is custom, take the caller's name, phone number, address and a short description, and tell them someone from the office will call them back to go over it.`;
    return `- ${s.name}: no fixed price. ${fee ? 'Say there is a $' + fee + ' service call fee, and that ' : 'Say that '}the technician gives an exact price on site before any work starts. Book the visit as usual.`;
  }).join('\n');
}

export function build(config) {
  const routine = config.services.filter((s) => !s.emergency).map((s) => s.name).join(', ');
  const vars = {
    business_name: config.businessName, trade: config.trade, time_zone: config.timeZone,
    services_list: routine, booking_hours: bookingHours(config.hours),
    extra_never_say: (config.neverSay || []).join(' '), price_list: priceList(config)
  };
  let out = template.replace(/\{\{current_time_<[^}]*>\}\}/, `{{current_time_${config.timeZone}}}`);
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
