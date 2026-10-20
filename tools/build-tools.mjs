// Generates retell/<businessId>-tools.json (the function definitions to enter in Retell) for businesses that need
// different arguments than the default plumbing set. Run: node tools/build-tools.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const base = JSON.parse(readFileSync(new URL('retell/tools.json', root), 'utf8'));
for (const f of readdirSync(new URL('config/', root)).filter((f) => f.endsWith('.json'))) {
  const c = JSON.parse(readFileSync(new URL('config/' + f, root), 'utf8'));
  if (c.collectAddress !== false) continue;   // default set already fits
  const tools = JSON.parse(JSON.stringify(base));
  tools.tools = tools.tools.filter((t) => t.name !== 'report_urgent_call');
  for (const t of tools.tools) {
    t.url = t.url.replace(/business=[^&]+/, 'business=' + c.businessId).replace('YOUR_N8N.app.n8n.cloud', 'icrob.app.n8n.cloud');
    if (t.name === 'book_appointment') {
      t.parameters.required = ['start', 'name', 'phone', 'service'];
      delete t.parameters.properties.someone_on_site;
      t.parameters.properties.address.description = 'Not needed for this business. Leave out.';
      t.parameters.properties.problem.description = 'The service(s) booked, for example the same text as service.';
      t.parameters.properties.service.description = "The service name exactly as listed. For several services in one visit join them with ' + '.";
      t.parameters.properties.barber = { type: 'string', description: "The barber the caller asked for, if any. This is only a request." };
    }
    if (t.name === 'check_availability') {
      t.parameters.properties.service.description = "The service name exactly as listed. For several services in one visit join them with ' + '.";
    }
    if (t.name === 'request_callback') t.parameters.required = ['name', 'phone', 'service', 'problem'];
    // Barbershop/salon wording: no technicians, jobs, estimates, addresses or confirmation texts.
    delete t.parameters.properties.visit_type;
    if (t.name === 'check_availability') {
      t.description = 'Get the next open appointment times for a service. Call this after you know which service the caller wants, and before offering times.';
      t.parameters.properties.purpose.description = "'booking' (default) to find appointment times. 'callback' to find times the shop can phone the caller back, used when the caller chose a callback.";
    }
    if (t.name === 'book_appointment') {
      t.description = 'Book the appointment the caller chose. Call it as soon as the caller has picked one of the offered times and you have their name and phone number. Do not ask permission first.';
      delete t.parameters.properties.address;
      delete t.parameters.properties.someone_on_site;
    }
    if (t.name === 'request_callback') {
      t.description = 'Email the shop a callback request for a caller who wants something the assistant cannot handle (a question it cannot answer, a complaint, a business inquiry). Use only after the caller agrees to a callback.';
      delete t.parameters.properties.address;
      delete t.parameters.properties.price_discussed;
      t.parameters.properties.service.description = 'The service the call is about, or what it is about in a few words.';
    }
    if (t.name === 'check_appointment') t.description = "Look up the caller's upcoming appointments by name and phone number. Use when a caller wants to check, cancel, or reschedule an appointment they already have. Returns each appointment's eventId, time and service.";
  }
  writeFileSync(new URL(`retell/${c.businessId}-tools.json`, root), JSON.stringify(tools, null, 2) + '\n');
  console.log('Wrote retell/' + c.businessId + '-tools.json');
}
