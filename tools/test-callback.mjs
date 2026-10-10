import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { buildCallbackEmail } = require('../n8n/code/callback.js');
const S = require('../n8n/code/slots.js');
const config = JSON.parse(readFileSync(new URL('../config/demo-plumbing.json', import.meta.url)));
let n = 0; const test = (t, f) => { f(); n++; console.log('ok  ' + t); };
const NOW = Date.parse('2026-10-12T15:00:00Z');
test('callback email has everything the office needs', () => {
  const e = buildCallbackEmail(config, { name: 'Sam Smith', phone: '5551234567', address: '12 Oak St', service: 'Water heater replacement', problem: 'Old tank leaking, wants a new one', preferred_callback_time: 'tomorrow afternoon', price_discussed: 'Typically $1,800 to $3,200' }, NOW);
  assert.equal(e.to, config.ownerEmail);
  assert.equal(e.subject, 'Demo Plumbing Co: Callback requested - Water heater replacement - Sam Smith');
  assert.match(e.body, /Best time to call back: tomorrow afternoon/); assert.match(e.body, /Typically \$1,800 to \$3,200/);
  assert.match(e.body, /No appointment has been booked/);
});
test('missing fields do not crash; header injection stripped; callbackEmail overrides owner', () => {
  const e = buildCallbackEmail({ ...config, callbackEmail: 'office@example.com' }, { name: 'X\r\nBcc: evil@x.com' }, NOW);
  assert.equal(e.to, 'office@example.com'); assert.doesNotMatch(e.subject, /[\r\n]/); assert.match(e.body, /as soon as possible/);
});
test('big job books a short ESTIMATE visit, not the whole job', () => {
  assert.equal(S.isBigJob(config, 'Water heater replacement'), true);
  assert.equal(S.isBigJob(config, 'Clogged toilet'), false);
  assert.equal(S.durationFor(config, 'Water heater replacement'), 60);
  assert.equal(S.durationFor(config, 'Sewer line repair or replacement'), 60);
});
console.log(`\n${n} tests passed`);
