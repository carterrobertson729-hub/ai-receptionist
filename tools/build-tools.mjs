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
  }
  writeFileSync(new URL(`retell/${c.businessId}-tools.json`, root), JSON.stringify(tools, null, 2) + '\n');
  console.log('Wrote retell/' + c.businessId + '-tools.json');
}
