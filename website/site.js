/* ===== Settings you edit ===== */
var CONTACT_EMAIL = 'carter.robertson729@gmail.com';
// Paste your Stripe Payment Link for each plan and billing period. While a link is empty, the checkout page lets the
// visitor reserve the plan and you send them a payment link.
var CHECKOUT_LINKS = {
  'backup-lite':     { monthly: 'https://buy.stripe.com/test_6oU5kFcsYe6h8wu3PScMM00', yearly: 'https://buy.stripe.com/test_9B63cx3Wse6h9AyeuwcMM07' },
  'backup-standard': { monthly: 'https://buy.stripe.com/test_bJe5kFfFa8LX142bikcMM01', yearly: 'https://buy.stripe.com/test_6oU3cx50wfalcMKbikcMM08' },
  'backup-plus':     { monthly: 'https://buy.stripe.com/test_7sY8wR8cId2d7sqbikcMM02', yearly: 'https://buy.stripe.com/test_6oUdRbgJe9Q1286bikcMM0e' },
  'always-starter':  { monthly: 'https://buy.stripe.com/test_9B69AV64A0fr7sq0DGcMM03', yearly: 'https://buy.stripe.com/test_14A7sN2Soe6haEC2LOcMM0c' },
  'always-standard': { monthly: 'https://buy.stripe.com/test_5kQ00l78E1jv4ge0DGcMM04', yearly: 'https://buy.stripe.com/test_fZudRb50w5zL5ki4TWcMM0d' },
  'always-plus':     { monthly: 'https://buy.stripe.com/test_4gMfZj50w9Q12863PScMM05', yearly: 'https://buy.stripe.com/test_dRm3cx50wgepaECdqscMM09' },
  'always-high':     { monthly: 'https://buy.stripe.com/test_aFa28t8cI3rDdQO724cMM06', yearly: 'https://buy.stripe.com/test_00w28tfFa6DP6omcmocMM0a' }
};
// Stripe customer portal login link (Stripe Dashboard > Settings > Billing > Customer portal > turn on the login link). Paste it here; until then the Log in page sends people to the contact page.
var PORTAL_LINK = '';
// Google sign-in (Firebase Authentication). Paste the web app config from Firebase here, for example:
// var FIREBASE_CONFIG = { apiKey: '...', authDomain: '...firebaseapp.com', projectId: '...', appId: '...' };
// Until it is set, the sign-in button explains that sign-in is almost ready. (These values are public by design, not secrets.)
var FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCIr2guVNbwYw0JjoZnQeeEEfwh-Sg-0tg',
  authDomain: 'answerbay-bf6f7.firebaseapp.com',
  projectId: 'answerbay-bf6f7',
  appId: '1:116359651974:web:d447a6768b2782981c2707'
};
// Where the website talks to your n8n workflows (hides booked demo times, lets people cancel or change a demo). Must end with a slash.
var N8N_BASE = 'https://icrob.app.n8n.cloud/webhook/website/';
// Two ways it can answer. "backup" = after-hours and missed calls. "always" = 24/7 receptionist (answers every call, can pass calls to staff).
var MODES = {
  backup: { label: 'After-hours & missed calls', title: 'After-hours and missed calls',
    desc: 'Your staff answer first. The receptionist catches the calls you miss and every call after hours, day and night. Best for shops that already have someone at the phone during the day.' },
  always: { label: '24/7 receptionist', title: '24/7 receptionist',
    desc: 'The receptionist answers every call, day and night, and can pass a call to your staff when a caller asks for a person during open hours. Best when nobody can reliably pick up the phone. It uses more minutes, so the plans are bigger.' }
};
var COMMON = ['Books into your calendar','Email summary after calls that matter','Call log and weekly report','Alerts at 80% and 100% of your minutes','Setup help and a phone number for the AI'];
var PLANS = [
  { id:'backup-lite',     mode:'backup', name:'Backup Lite',     short:'Lite',        monthly:59,  minutes:150,  calls:60,  who:'One-chair shops and solo owners',
    feats:['150 minutes a month','Catches missed calls','Answers every call after hours'].concat(COMMON) },
  { id:'backup-standard', mode:'backup', name:'Backup Standard', short:'Standard',    monthly:89,  minutes:300,  calls:120, who:'Shops with a steady phone', pop:true,
    feats:['300 minutes a month','Everything in Lite','Room for a busier phone'] },
  { id:'backup-plus',     mode:'backup', name:'Backup Plus',     short:'Plus',        monthly:139, minutes:500,  calls:200, who:'Busy shops that miss calls often',
    feats:['500 minutes a month','Everything in Standard','Built for the busiest backup shops'] },
  { id:'always-starter',  mode:'always', name:'24/7 Starter',    short:'Starter',     monthly:119, minutes:300,  calls:120, who:'Small shops that want every call answered',
    feats:['300 minutes a month','Answers every call, day and night','Can pass calls to your staff when asked (launching soon)'].concat(COMMON) },
  { id:'always-standard', mode:'always', name:'24/7 Standard',   short:'Standard',    monthly:179, minutes:500,  calls:200, who:'Most 24/7 businesses', pop:true,
    feats:['500 minutes a month','Everything in Starter','Room for steady call volume'] },
  { id:'always-plus',     mode:'always', name:'24/7 Plus',       short:'Plus',        monthly:239, minutes:750,  calls:300, who:'Busy shops with several staff',
    feats:['750 minutes a month','Everything in Standard','Built for busy phones'] },
  { id:'always-high',     mode:'always', name:'24/7 High volume',short:'High volume', monthly:349, minutes:1200, calls:480, who:'High call volume',
    feats:['1,200 minutes a month','Everything in Plus','For the busiest businesses'] }
];
var ADDONS = [
  { id:'spanish', name:'Spanish', monthly:15, setup:0, text:'If a caller speaks Spanish, the receptionist switches to Spanish and helps them in their language.' },
  { id:'number',  name:'Extra number', monthly:15, setup:0, text:'Another phone number for a second location. It shares your plan\'s minutes.' }
];
var SETUP_FEE = 99;
var DISCOUNT = 0.10; // yearly plans are 10% off, rounded down to a whole dollar
var INDUSTRIES = { barbershop: 'Barbershop or salon', trades: 'Plumbing or home services', repair: 'Repair shop', landscaping: 'Landscaping', custom: 'Several locations (custom plan)' };

/* ===== Page logic ===== */
function $(id){ return document.getElementById(id); }
function money(n){ return '$' + (Math.round(n*100)%100===0 ? Math.round(n).toLocaleString('en-US') : n.toFixed(2)); }
function planById(id){ return PLANS.filter(function(p){ return p.id === id; })[0]; }
var cycle = 'monthly';
var query = new URLSearchParams(window.location.search);
var mode = query.get('mode') === 'always' ? 'always' : 'backup';

function renderPlans(){
  var html = '';
  PLANS.filter(function(p){ return p.mode === mode; }).forEach(function(p){
    var yearTotal = Math.floor(p.monthly * 12 * (1 - DISCOUNT));
    var perMonth = cycle === 'yearly' ? Math.floor(p.monthly * (1 - DISCOUNT)) : p.monthly;
    html += '<article class="plan' + (p.pop ? ' pop' : '') + '">' + (p.pop ? '<div class="pop-badge">Most popular</div>' : '') +
      '<h3>' + p.short + '</h3><p class="for">' + p.who + '</p>' +
      '<div class="price"><b>' + money(perMonth) + '</b><span>/ month</span></div>' +
      '<div class="billed">' + (cycle === 'yearly' ? 'Billed ' + money(yearTotal) + ' per year (you save ' + money(p.monthly*12 - yearTotal) + ')' : 'Billed monthly') + '</div>' +
      '<div class="mins"><b>' + p.minutes.toLocaleString('en-US') + ' minutes</b><small>About ' + p.calls + ' calls a month</small></div>' +
      '<ul class="ticks">' + p.feats.map(function(f){ return '<li>' + f + '</li>'; }).join('') + '</ul>' +
      '<a class="btn ' + (p.pop ? 'btn-primary' : 'btn-ghost') + ' btn-block" href="checkout.html?plan=' + p.id + '&cycle=' + cycle + '">Choose ' + p.name + '</a></article>';
  });
  $('plans').className = 'plans' + (PLANS.filter(function(p){ return p.mode === mode; }).length === 3 ? ' three' : '');
  $('plans').innerHTML = html;
  if ($('modeDesc')) $('modeDesc').innerHTML = '<strong>' + MODES[mode].title + ':</strong> ' + MODES[mode].desc;
}
function setCycle(c){
  cycle = c;
  $('bMonthly').setAttribute('aria-pressed', c === 'monthly');
  $('bYearly').setAttribute('aria-pressed', c === 'yearly');
  renderPlans();
}
function setMode(m){
  mode = m;
  if ($('mBackup')) { $('mBackup').setAttribute('aria-pressed', m === 'backup'); $('mAlways').setAttribute('aria-pressed', m === 'always'); }
  renderPlans();
}
if ($('plans')) {
  $('bMonthly').onclick = function(){ setCycle('monthly'); };
  $('bYearly').onclick = function(){ setCycle('yearly'); };
  if ($('mBackup')) { $('mBackup').onclick = function(){ setMode('backup'); }; $('mAlways').onclick = function(){ setMode('always'); }; }
  setMode(mode);
}

// "Which plan fits" cards on the industry pages. The page sets window.FIT = [{id, note}, ...]
if ($('fit') && window.FIT) {
  $('fit').innerHTML = window.FIT.map(function(f){
    var p = planById(f.id);
    // the whole card is one link to the pricing page
    return '<a class="plan plan-link' + (f.pop ? ' pop' : '') + '" href="pricing.html#plans" aria-label="' + p.name + ' plan, ' + money(p.monthly) + ' a month. See the pricing page">' + (f.pop ? '<div class="pop-badge">' + (f.badge || 'Good fit') + '</div>' : '') +
      '<h3>' + p.name + '</h3><div class="price"><b>' + money(p.monthly) + '</b><span>/ month</span></div>' +
      '<div class="mins"><b>' + p.minutes.toLocaleString('en-US') + ' minutes</b><small>About ' + p.calls + ' calls a month</small></div>' +
      '<p class="fit-note">' + f.note + '</p><span class="more-link" aria-hidden="true">See pricing &rarr;</span></a>';
  }).join('');
}

// tabs (home page)
var tabs = document.querySelectorAll('.tab');
tabs.forEach(function(t){
  t.addEventListener('click', function(){
    tabs.forEach(function(x){ x.setAttribute('aria-selected', x === t); });
    document.querySelectorAll('.panel').forEach(function(p){ var on = p.id === t.getAttribute('aria-controls'); p.classList.toggle('show', on); p.hidden = !on; });
  });
});

// mobile menu
var menuBtn = $('menuBtn'), navList = $('navList');
if (menuBtn && navList) {
  menuBtn.onclick = function(){ var o = navList.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', o); };
  navList.addEventListener('click', function(e){
    if (e.target.closest('.sub-toggle')) return;   // the little arrow only opens the Services list
    navList.classList.remove('open'); menuBtn.setAttribute('aria-expanded', false);
  });
}
// Services dropdown: the arrow opens the list (on phones and for keyboard users); hover also opens it on a computer
document.querySelectorAll('.sub-toggle').forEach(function(b){
  b.addEventListener('click', function(){ var li = b.parentNode, o = li.classList.toggle('open'); b.setAttribute('aria-expanded', o); });
});
// mark the page you are on in the menu
(function(){
  var here = window.location.pathname.split('/').pop() || 'index.html';
  var inServices = ['barbershops.html','trades.html','repair.html','landscaping.html'].indexOf(here) !== -1;
  document.querySelectorAll('#navList > li > a').forEach(function(a){
    var h = a.getAttribute('href');
    if (h === here || (inServices && h === 'services.html')) a.setAttribute('aria-current', 'page');
  });
})();

// pre-select the business type: from the page (data-industry) or the link (?for=barbershop)
var industry = document.body.getAttribute('data-industry') || INDUSTRIES[query.get('for')] || '';
if (industry && $('cType')) { $('cType').value = industry; }
if (query.get('topic') && $('cTopic')) {
  var topics = { repair: 'Repair shops', landscaping: 'Landscaping', custom: 'Custom plan (several locations)', account: 'Help with my account' };
  if (topics[query.get('topic')]) $('cTopic').value = topics[query.get('topic')];
}

// prefill name and email after sign-in (links from the login page carry ?email=&name=, and the browser remembers the last sign-in)
(function(){
  var em = query.get('email'), nm = query.get('name');
  try { em = em || localStorage.getItem('ab_email'); nm = nm || localStorage.getItem('ab_name'); } catch (e) {}
  document.querySelectorAll('input[name="email"]:not([type="hidden"])').forEach(function(i){ if (em && !i.value) i.value = em; });
  document.querySelectorAll('input[name="name"]:not([type="hidden"])').forEach(function(i){ if (nm && !i.value) i.value = nm; });
})();


// ===== signed-in header: Log in turns into a small account menu with Sign out =====
(function(){
  function get(k){ try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function clear(){ try { localStorage.removeItem('ab_email'); localStorage.removeItem('ab_name'); } catch (e) {} }
  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]; }); }
  var cta = document.querySelector('.nav-cta');
  var loginBtn = cta && cta.querySelector('a[href="login.html"]');
  var mobileLogin = document.querySelector('#navList li.only-mobile a[href="login.html"]');
  var footLogins = document.querySelectorAll('.foot-links a[href="login.html"]');
  var menu = null, fbPromise = null;

  // load Firebase once (used by the login page and by this menu)
  function load(src){ return new Promise(function(ok, bad){ var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = bad; document.head.appendChild(s); }); }
  function loadFirebase(){
    if (typeof FIREBASE_CONFIG === 'undefined' || !FIREBASE_CONFIG) return Promise.reject(new Error('no config'));
    if (fbPromise) return fbPromise;
    var base = 'https://www.gstatic.com/firebasejs/10.12.2/';
    fbPromise = load(base + 'firebase-app-compat.js').then(function(){ return load(base + 'firebase-auth-compat.js'); }).then(function(){
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      return firebase.auth();
    });
    return fbPromise;
  }

  function render(email, name){
    if (menu) { menu.remove(); menu = null; }
    if (!email) {
      if (loginBtn) loginBtn.style.display = '';
      if (mobileLogin) { mobileLogin.textContent = 'Log in'; mobileLogin.setAttribute('href', 'login.html'); mobileLogin.onclick = null; }
      footLogins.forEach(function(a){ a.textContent = 'Log in'; });
      return;
    }
    var shown = name || email.split('@')[0];
    if (loginBtn) loginBtn.style.display = 'none';
    if (cta) {
      menu = document.createElement('div'); menu.className = 'acct';
      menu.innerHTML = '<button type="button" class="acct-btn" aria-haspopup="true" aria-expanded="false"><span class="acct-ini">' + esc(shown.charAt(0).toUpperCase()) + '</span><span class="acct-name">' + esc(shown.split(' ')[0]) + '</span><span class="acct-caret">&#9662;</span></button>' +
        '<div class="acct-menu" hidden><div class="acct-email">' + esc(email) + '</div><a href="setup.html">My setup form</a><a href="login.html">My account</a><button type="button" class="acct-out">Sign out</button></div>';
      cta.insertBefore(menu, cta.firstChild);
      var btn = menu.querySelector('.acct-btn'), panel = menu.querySelector('.acct-menu');
      btn.onclick = function(e){ e.stopPropagation(); var open = panel.hidden; panel.hidden = !open; btn.setAttribute('aria-expanded', open); };
      menu.querySelector('.acct-out').onclick = signOut;
    }
    if (mobileLogin) { mobileLogin.textContent = 'Sign out'; mobileLogin.setAttribute('href', '#'); mobileLogin.onclick = function(e){ e.preventDefault(); signOut(); }; }
    footLogins.forEach(function(a){ a.textContent = 'My account'; });
  }
  document.addEventListener('click', function(e){ if (menu && !menu.contains(e.target)) { var p = menu.querySelector('.acct-menu'), b = menu.querySelector('.acct-btn'); if (p) p.hidden = true; if (b) b.setAttribute('aria-expanded', false); } });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && menu) { var p = menu.querySelector('.acct-menu'); if (p) p.hidden = true; } });

  function signOut(){
    clear(); render('', '');
    loadFirebase().then(function(auth){ return auth.signOut(); }).catch(function(){});
    if (/login\.html$/.test(window.location.pathname) && window.abLoginRefresh) window.abLoginRefresh(null);
  }
  function remember(u){ try { localStorage.setItem('ab_email', u.email || ''); localStorage.setItem('ab_name', u.displayName || ''); } catch (e) {} }

  window.abAccount = { render: render, signOut: signOut, load: loadFirebase, remember: remember, clear: clear };

  // show the menu straight away if this browser signed in before, then confirm with Firebase
  var email = get('ab_email');
  if (email) {
    render(email, get('ab_name'));
    loadFirebase().then(function(auth){
      auth.onAuthStateChanged(function(u){
        if (u) { remember(u); render(u.email || '', u.displayName || ''); }
        else { clear(); render('', ''); }
      });
    }).catch(function(){});
  }
})();

// duplicate the moving banners so they loop smoothly
document.querySelectorAll('.track[data-dup]').forEach(function(t){ t.innerHTML += t.innerHTML; });

// Forms are collected by Netlify Forms (data-netlify). Nothing opens an email app.
function sendForm(form, onDone){
  var note = form.querySelector('[data-note]');
  function fail(){ if (note) note.innerHTML = 'Sorry, that did not send. Please email us at <a href="mailto:' + CONTACT_EMAIL + '">' + CONTACT_EMAIL + '</a> and we will help right away.'; }
  var body = new URLSearchParams(new FormData(form)).toString();
  var btn = form.querySelector('button[type="submit"]'); if (btn) btn.disabled = true;
  fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body })
    .then(function(r){ if (!r.ok) throw new Error('bad'); onDone(); })
    .catch(function(){ fail(); if (btn) btn.disabled = false; });
}
document.querySelectorAll('form[data-netlify]').forEach(function(form){
  form.addEventListener('submit', function(e){
    e.preventDefault();
    if (form.hasAttribute('data-custom')) return;   // the page script (demo, checkout) handles these
    if (!form.checkValidity()) { form.reportValidity(); return; }
    sendForm(form, function(){
      form.hidden = true;
      var ok = document.querySelector('[data-success]'); if (ok) { ok.hidden = false; ok.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    });
  });
});
if ($('yr')) $('yr').textContent = new Date().getFullYear();
