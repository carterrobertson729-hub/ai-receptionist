// PASTE INTO n8n: workflow "Website - Form Alerts" > node "Add Website Notes" > Code tab (select all, replace, Save).
// Website scan: given the web address a customer typed on the setup form, read that public page and pull out
// what helps build their receptionist (phones, hours, prices, headings, booking tools). First page only.
// Self-contained; unit-tested by tools/test-sitescan.mjs.

// Only plain public http(s) addresses. Blocks localhost, IP addresses and internal names.
function siteScanTarget(raw) {
  var v = String(raw == null ? '' : raw).trim();
  if (!v || /\s/.test(v)) return '';
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = 'https://' + v;
  var u;
  try { u = new URL(v); } catch (e) { return ''; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
  if (u.username || u.password) return '';
  if (u.port && u.port !== '80' && u.port !== '443') return '';
  var h = u.hostname.toLowerCase();
  if (h.indexOf('.') === -1 || h.indexOf('[') !== -1 || h.indexOf(':') !== -1) return '';
  if (/^\d+(\.\d+){3}$/.test(h) || /^[\d.]+$/.test(h)) return '';
  if (/(^|\.)(localhost|local|internal|lan|home|corp|intranet)$/.test(h)) return '';
  return u.href;
}

function ssDecode(t) {
  return String(t)
    .replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#36;/g, '$')
    .replace(/&#(\d+);/g, function (m, n) { try { return String.fromCharCode(+n); } catch (e) { return ' '; } })
    .replace(/&[a-z]+;/g, ' ');
}

function ssUnique(list, max) {
  var seen = {}, out = [];
  list.forEach(function (x) { var k = x.toLowerCase(); if (x && !seen[k] && out.length < max) { seen[k] = 1; out.push(x); } });
  return out;
}

function siteScan(html, url) {
  var raw = String(html == null ? '' : html).slice(0, 600000);
  if (!raw.trim()) return 'WEBSITE SCAN of ' + url + '\nNothing came back from that address (the site may block automated visits, or be down). Open it yourself.';
  var title = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(raw) || [])[1] || '';
  var desc = (/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]*content=["']([^"']*)["']/i.exec(raw) || /<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["'](?:description|og:description)["']/i.exec(raw) || [])[1] || '';
  var phonesTel = (raw.match(/href=["']tel:([^"']+)["']/gi) || []).map(function (m) { return decodeURIComponent(m.replace(/^href=["']tel:/i, '').replace(/["']$/, '')).replace(/[^\d+()\-.\s]/g, '').trim(); });
  var emailsMail = (raw.match(/mailto:([^"'?\s>]+)/gi) || []).map(function (m) { return m.replace(/^mailto:/i, ''); });
  var hrefs = (raw.match(/href=["']([^"']+)["']/gi) || []).map(function (m) { return m.replace(/^href=["']/i, '').replace(/["']$/, ''); });
  var tools = [['squareup.com', 'Square'], ['square.site', 'Square'], ['booksy.com', 'Booksy'], ['fresha.com', 'Fresha'], ['vagaro.com', 'Vagaro'], ['setmore.com', 'Setmore'], ['acuityscheduling.com', 'Acuity'], ['calendly.com', 'Calendly'], ['getsquire.com', 'Squire'], ['thecut.co', 'The Cut'], ['schedulicity.com', 'Schedulicity'], ['jobber.com', 'Jobber'], ['housecallpro.com', 'Housecall Pro'], ['servicetitan.com', 'ServiceTitan'], ['mindbodyonline.com', 'Mindbody'], ['glossgenius.com', 'GlossGenius'], ['boulevard.io', 'Boulevard'], ['google.com/maps', 'Google Maps']];
  var found = [];
  tools.forEach(function (t) { if (hrefs.some(function (h) { return h.toLowerCase().indexOf(t[0]) !== -1; }) || raw.toLowerCase().indexOf(t[0]) !== -1) found.push(t[1]); });

  var heads = [];
  var hre = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi, hm;
  while ((hm = hre.exec(raw)) && heads.length < 40) heads.push(ssDecode(hm[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim());

  var body = raw.replace(/<head[\s\S]*?<\/head>/i, ' ').replace(/<title[\s\S]*?<\/title>/i, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, ' ');
  body = body.replace(/<\/(p|div|li|h[1-6]|tr|td|th|section|article|header|footer|ul|ol|table|address)>|<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ');
  var lines = ssDecode(body).split('\n').map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(function (l) { return l && l.length < 220; });
  var textLen = lines.join(' ').length;

  var phoneRe = /\(?\b\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}\b/g;
  var phones = ssUnique(phonesTel.concat(lines.join(' ').match(phoneRe) || []), 5);
  var emails = ssUnique(emailsMail.concat(lines.join(' ').match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g) || []).filter(function (e) { return !/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(e); }), 3);
  var hours = ssUnique(lines.filter(function (l) { return /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\b/i.test(l) && (/\d{1,2}(:\d{2})?\s*(am|pm|a\.m\.|p\.m\.)/i.test(l) || /\bclosed\b/i.test(l)); }).map(function (l) { return l.slice(0, 120); }), 14);
  var prices = ssUnique(lines.filter(function (l) { return /\$\s?\d/.test(l); }).map(function (l) { return l.slice(0, 120); }), 30);
  var addr = ssUnique(lines.filter(function (l) { return /\b\d{2,5}\s+[A-Za-z0-9 .]+\b(street|st\.?|ave\.?|avenue|rd\.?|road|blvd\.?|boulevard|hwy\.?|highway|drive|dr\.?|lane|ln\.?|way|pkwy|parkway)\b/i.test(l) && /\b\d{5}\b/.test(l); }).map(function (l) { return l.slice(0, 140); }), 2);

  var out = ['WEBSITE SCAN of ' + url + ' (first page only. Check the site yourself too)'];
  if (title) out.push('Title: ' + ssDecode(title).replace(/\s+/g, ' ').trim().slice(0, 140));
  if (desc) out.push('Description: ' + ssDecode(desc).replace(/\s+/g, ' ').trim().slice(0, 240));
  if (phones.length) out.push('Phones: ' + phones.join(', '));
  if (emails.length) out.push('Emails: ' + emails.join(', '));
  if (addr.length) out.push('Address (guess): ' + addr.join(' | '));
  if (found.length) out.push('Booking tools or maps linked: ' + ssUnique(found, 8).join(', '));
  if (hours.length) out.push('Hours lines:\n- ' + hours.join('\n- '));
  if (prices.length) out.push('Prices found:\n- ' + prices.join('\n- '));
  var hd = ssUnique(heads.filter(Boolean), 12);
  if (hd.length) out.push('Headings:\n- ' + hd.join('\n- '));
  if (textLen < 400) out.push('Very little text came back. The page is probably built with JavaScript (Square, Wix, a booking widget). Open it yourself for the services and prices.');
  else if (!prices.length) out.push('No prices were found on this page. Services and prices may be on another page.');
  return out.join('\n');
}


// Joins the page we fetched onto the email. If the fetch failed, the email still goes out with a short note.
var mail = $('Build Form Email').first().json;
var got = $input.first().json || {};
var html = typeof got.data === 'string' ? got.data : (typeof got.body === 'string' ? got.body : '');
var note;
if (got.error || !html) note = 'WEBSITE SCAN of ' + mail.scanUrl + '\nCould not read the page (' + String((got.error && (got.error.message || got.error)) || 'no content') .slice(0, 120) + '). Open it yourself.';
else note = siteScan(html, mail.scanUrl);
return [{ json: Object.assign({}, mail, { body: mail.body + '\n\n----------------------------------------\n' + note }) }];
