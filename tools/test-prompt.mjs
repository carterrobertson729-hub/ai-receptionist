import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { build, bookingHours, priceList } from './build-prompt.mjs';
const config = JSON.parse(readFileSync(new URL('../config/demo-plumbing.json', import.meta.url)));
let n = 0; const test = (t, f) => { f(); n++; console.log('ok  ' + t); };
test('no unfilled placeholders except Retell\'s own time variable', () => {
  const left = build(config).match(/\{\{[^}]*\}\}/g);
  assert.deepEqual(left, ['{{current_time_America/Chicago}}']);
});
test('flat price jobs state the amount; callback jobs never book', () => {
  const p = priceList(config);
  assert.match(p, /Clogged toilet: flat price of \$50/);
  assert.match(p, /Water heater replacement: do NOT quote a price and do NOT check availability or book/);
});
test('quote-on-site jobs mention only the service call fee', () => {
  assert.match(priceList(config), /Leak repair: no fixed price\. Say there is a \$65 service call fee/);
  assert.doesNotMatch(priceList(config), /Leak repair:.*\$(?!65)\d/);
});
test('missing pricing defaults to quote on site, and no fee wording when there is no fee', () => {
  const c = { ...config, serviceCallFee: undefined, services: [{ name: 'Test job', emergency: false }] };
  assert.match(priceList(c), /Test job: no fixed price\. Say that the technician gives an exact price/);
});
test('emergency services are not in the routine price list', () => {
  assert.doesNotMatch(priceList(config), /Burst pipe/);
});
test('booking hours read naturally', () => {
  const d = (o) => ({ mon: o, tue: o, wed: o, thu: o, fri: o, sat: null, sun: null });
  assert.equal(bookingHours(d(['08:00', '17:00'])), 'Monday through Friday, 8 AM to 5 PM. The office is closed Saturday and Sunday');
  assert.equal(bookingHours({ ...d(['08:00', '17:00']), sat: ['09:00', '13:30'] }), 'Monday through Friday, 8 AM to 5 PM; Saturday, 9 AM to 1:30 PM. The office is closed Sunday');
  assert.equal(bookingHours(config.hours), 'Every day of the week, 8 AM to 5 PM');
});
console.log(`\n${n} tests passed`);
