/* ===== Settings you edit ===== */
var CONTACT_EMAIL = 'carter.robertson729@gmail.com';
// Paste your Stripe Payment Link for each plan and billing period. While a link is empty, the checkout page lets the
// visitor reserve the plan and you send them a payment link.
var CHECKOUT_LINKS = {
  starter:  { monthly: '', yearly: '' },
  standard: { monthly: '', yearly: '' },
  plus:     { monthly: '', yearly: '' },
  high:     { monthly: '', yearly: '' }
};
var PLANS = [
  { id:'starter',  name:'Starter',     monthly:99,  minutes:300,  calls:120, who:'One-chair shops and solo owners',
    feats:['300 minutes a month','One location, answered 24/7','Books into your calendar','Email summary after calls that matter','Call log and weekly report','Setup help and a phone number for the AI'] },
  { id:'standard', name:'Standard',    monthly:159, minutes:500,  calls:200, who:'Growing shops and busy trades', pop:true,
    feats:['500 minutes a month','Everything in Starter','Best fit for most small businesses','Usage alerts at 80% and 100%'] },
  { id:'plus',     name:'Plus',        monthly:219, minutes:750,  calls:300, who:'Busy shops with several staff',
    feats:['750 minutes a month','Everything in Standard','Room for answering more of your calls'] },
  { id:'high',     name:'High volume', monthly:329, minutes:1200, calls:480, who:'High call volume or main-line answering',
    feats:['1,200 minutes a month','Everything in Plus','Built for answering every call'] }
];
var ADDONS = [
  { id:'spanish', name:'Spanish', monthly:15, setup:0, text:'Switches to Spanish when the caller speaks it.' },
  { id:'main',    name:'Main line + transfer', monthly:25, setup:0, soon:true, text:'Answers every call and passes calls to your staff when asked.' },
  { id:'number',  name:'Extra number', monthly:10, setup:0, text:'A second line for another location or an ad.' }
];
var SETUP_FEE = 99;
var DISCOUNT = 0.10; // yearly plans are 10% off, rounded down to a whole dollar
var INDUSTRIES = { barbershop: 'Barbershop or salon', trades: 'Plumbing or trades', repair: 'Repair shop', landscaping: 'Landscaping' };

/* ===== Page logic ===== */
function $(id){ return document.getElementById(id); }
function money(n){ return '$' + (Math.round(n*100)%100===0 ? Math.round(n).toLocaleString('en-US') : n.toFixed(2)); }
function planById(id){ return PLANS.filter(function(p){ return p.id === id; })[0]; }
var cycle = 'monthly';

function renderPlans(){
  var html = '';
  PLANS.forEach(function(p){
    var yearTotal = Math.floor(p.monthly * 12 * (1 - DISCOUNT));
    var perMonth = cycle === 'yearly' ? Math.floor(p.monthly * (1 - DISCOUNT)) : p.monthly;
    html += '<article class="plan' + (p.pop ? ' pop' : '') + '">' + (p.pop ? '<div class="pop-badge">Most popular</div>' : '') +
      '<h3>' + p.name + '</h3><p class="for">' + p.who + '</p>' +
      '<div class="price"><b>' + money(perMonth) + '</b><span>/ month</span></div>' +
      '<div class="billed">' + (cycle === 'yearly' ? 'Billed ' + money(yearTotal) + ' per year (you save ' + money(p.monthly*12 - yearTotal) + ')' : 'Billed monthly') + '</div>' +
      '<div class="mins"><b>' + p.minutes.toLocaleString('en-US') + ' minutes</b><small>About ' + p.calls + ' calls a month</small></div>' +
      '<ul class="ticks">' + p.feats.map(function(f){ return '<li>' + f + '</li>'; }).join('') + '</ul>' +
      '<a class="btn ' + (p.pop ? 'btn-primary' : 'btn-ghost') + ' btn-block" href="checkout.html?plan=' + p.id + '&cycle=' + cycle + '">Choose ' + p.name + '</a></article>';
  });
  $('plans').innerHTML = html;
}
function setCycle(c){
  cycle = c;
  $('bMonthly').setAttribute('aria-pressed', c === 'monthly');
  $('bYearly').setAttribute('aria-pressed', c === 'yearly');
  renderPlans();
}
if ($('plans')) {
  $('bMonthly').onclick = function(){ setCycle('monthly'); };
  $('bYearly').onclick = function(){ setCycle('yearly'); };
  renderPlans();
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
var query = new URLSearchParams(window.location.search);
var industry = document.body.getAttribute('data-industry') || INDUSTRIES[query.get('for')] || '';
if (industry && $('cType')) { $('cType').value = industry; }
if (query.get('topic') && $('cTopic')) {
  var topics = { repair: 'Repair shops', landscaping: 'Landscaping' };
  if (topics[query.get('topic')]) $('cTopic').value = topics[query.get('topic')];
}

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
