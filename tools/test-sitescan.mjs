import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { siteScan, siteScanTarget } = require('../n8n/code/sitescan.js');
let n = 0; const test = (t, f) => { f(); n++; console.log('ok  ' + t); };
test('target: adds https, accepts normal sites, keeps paths', () => {
  assert.equal(siteScanTarget('tonicbarber.com'), 'https://tonicbarber.com/');
  assert.equal(siteScanTarget(' https://www.shop.com/book?x=1 '), 'https://www.shop.com/book?x=1');
});
test('target: rejects localhost, IPs, internal names, odd ports, other schemes, credentials, spaces, junk', () => {
  for (const bad of ['http://localhost/', 'http://127.0.0.1/', 'https://10.0.0.5/x', 'http://169.254.169.254/latest', 'https://printer.local/', 'https://intranet/', 'http://[::1]/', 'ftp://shop.com/', 'file:///etc/passwd', 'https://a.com:8080/', 'https://user:pw@shop.com/', 'two words.com', '', null, 'javascript:alert(1)'])
    assert.equal(siteScanTarget(bad), '', 'should reject ' + bad);
});
const page = `<html><head><title>Tonic Barbershop &amp; Co</title><meta name="description" content="Fades, cuts and shaves in Schererville"></head><body>
<h1>Welcome to Tonic</h1><h2>Our Services</h2><script>var x='$999 Mon 9am';</script>
<ul><li>Men's Haircut - 30 min - $27</li><li>Boys Cut $22</li><li>Bald Fade $30</li></ul>
<div>Tue - Fri: 4:00 PM - 6:00 PM</div><div>Sat 9am-2pm</div><div>Sun &amp; Mon: Closed</div>
<address>2169 US Highway 41, Schererville, IN 46375</address>
<a href="tel:+12195551234">Call</a> (219) 555-1234 <a href="mailto:hi@tonic.com">email</a>
<a href="https://tonic.square.site/book">Book now</a><p>${'Lorem ipsum dolor sit amet. '.repeat(30)}</p></body></html>`;
test('scan: finds title, description, phones (deduped), email, address, hours, prices, headings, booking tool', () => {
  const t = siteScan(page, 'https://tonic.com/');
  assert.match(t, /Title: Tonic Barbershop & Co/); assert.match(t, /Description: Fades, cuts and shaves/);
  assert.match(t, /Phones: .*219/); assert.equal((t.match(/555-1234/g) || []).length <= 2, true);
  assert.match(t, /Emails: hi@tonic\.com/); assert.match(t, /Address \(guess\): .*2169 US Highway 41/);
  assert.match(t, /Booking tools or maps linked: Square/); assert.match(t, /- Men's Haircut - 30 min - \$27/); assert.match(t, /Bald Fade \$30/);
  assert.match(t, /Tue - Fri: 4:00 PM - 6:00 PM/); assert.match(t, /Sun & Mon: Closed/); assert.match(t, /Headings:\n- Welcome to Tonic\n- Our Services/);
});
test('scan: ignores script and style text', () => { assert.doesNotMatch(siteScan(page, 'u'), /\$999/); });
test('scan: warns when a page is empty or built with JavaScript', () => {
  assert.match(siteScan('<html><body><div id="root"></div><script>app()</script></body></html>', 'u'), /Very little text came back/);
  assert.match(siteScan('', 'u'), /Nothing came back/);
  assert.match(siteScan(null, 'u'), /Nothing came back/);
});
test('scan: tells you when no prices are on the page', () => {
  const html = '<body>' + '<p>We cut hair and we like it. </p>'.repeat(40) + '</body>';
  assert.match(siteScan(html, 'u'), /No prices were found/);
});
console.log(n + ' tests passed');
