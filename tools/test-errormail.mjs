import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { errorEmail } = require('../n8n/code/errormail.js');
let n = 0; const test = (t, f) => { f(); n++; console.log('ok  ' + t); };
const o = { ownerEmail: 'me@x.com', ignoreName: 'Error Alerts' };
test('builds a clear email with the workflow, step, message and link', () => {
  const r = errorEmail({ workflow: { name: 'Receptionist - Book Appointment' }, execution: { id: '77', url: 'https://n8n.example/execution/77', lastNodeExecuted: 'Create Event', error: { message: 'Insufficient permissions' } } }, o);
  assert.equal(r.ok, true); assert.equal(r.to, 'me@x.com'); assert.equal(r.subject, 'n8n FAILED: Receptionist - Book Appointment (Create Event)');
  assert.match(r.body, /Insufficient permissions/); assert.match(r.body, /execution\/77/);
});
test('handles missing pieces and long messages without crashing', () => {
  const r = errorEmail({}, o); assert.equal(r.subject, 'n8n FAILED: Unknown workflow (unknown step)');
  assert.equal(errorEmail({ execution: { error: { message: 'x'.repeat(2000) } } }, o).body.length < 1200, true);
});
test('never alerts about the alert workflow itself', () => {
  assert.equal(errorEmail({ workflow: { name: 'Receptionist - Error Alerts' } }, o).ok, false);
});
console.log(n + ' tests passed');
