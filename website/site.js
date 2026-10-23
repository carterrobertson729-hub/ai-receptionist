/* ===== Settings you edit ===== */
var CONTACT_EMAIL = 'carter.robertson729@gmail.com';
// Paste your Stripe Payment Link for each plan and billing period. While a link is empty, the button emails you instead.
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
var DISCOUNT = 0.10; // yearly plans are 10% off, rounded down to a whole dollar

/* ===== Page logic ===== */
function $(id){ return document.getElementById(id); }
function money(n){ return '$' + (Math.round(n*100)%100===0 ? Math.round(n).toLocaleString('en-US') : n.toFixed(2)); }
var cycle = 'monthly';

function planById(id){ return PLANS.filter(function(p){ return p.id === id; })[0]; }

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
      '<a class="btn ' + (p.pop ? 'btn-primary' : 'btn-ghost') + ' btn-block" data-plan="' + p.id + '" href="#">Choose ' + p.name + '</a></article>';
  });
  $('plans').innerHTML = html;
  document.querySelectorAll('[data-plan]').forEach(function(a){
    var id = a.getAttribute('data-plan'), link = CHECKOUT_LINKS[id] && CHECKOUT_LINKS[id][cycle];
    if (link) { a.href = link; a.rel = 'noopener'; }
    else {
      var plan = planById(id);
      a.href = 'mailto:' + CONTACT_EMAIL + '?subject=' + encodeURIComponent('AnswerBay ' + plan.name + ' (' + cycle + ')') +
        '&body=' + encodeURIComponent('Hi, I would like to start the ' + plan.name + ' plan, billed ' + cycle + '.\n\nBusiness name:\nType of business:\nPhone number to forward:\n');
    }
  });
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
    return '<article class="plan' + (f.pop ? ' pop' : '') + '">' + (f.pop ? '<div class="pop-badge">' + (f.badge || 'Good fit') + '</div>' : '') +
      '<h3>' + p.name + '</h3><div class="price"><b>' + money(p.monthly) + '</b><span>/ month</span></div>' +
      '<div class="mins"><b>' + p.minutes.toLocaleString('en-US') + ' minutes</b><small>About ' + p.calls + ' calls a month</small></div>' +
      '<p class="fit-note">' + f.note + '</p></article>';
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
  navList.addEventListener('click', function(){ navList.classList.remove('open'); menuBtn.setAttribute('aria-expanded', false); });
}

// trial and demo buttons pre-select the matching choice in the contact form
var want = $('cWant');
if (want) {
  document.querySelectorAll('[data-trial]').forEach(function(a){ a.addEventListener('click', function(){ want.value = 'trial'; }); });
  document.querySelectorAll('[data-demo]').forEach(function(a){ a.addEventListener('click', function(){ want.value = 'demo'; }); });
}
// an industry page pre-selects its business type
var industry = document.body.getAttribute('data-industry');
if (industry && $('cType')) { $('cType').value = industry; }

// duplicate the moving banners so they loop smoothly
document.querySelectorAll('.track[data-dup]').forEach(function(t){ t.innerHTML += t.innerHTML; });

// contact form opens the visitor's email app
var form = $('contactForm');
if (form) form.addEventListener('submit', function(e){
  e.preventDefault();
  var f = function(id){ return $(id).value.trim(); };
  if (!f('cName') || !/.+@.+\..+/.test(f('cEmail'))) { $('formNote').textContent = 'Please enter your name and a valid email.'; return; }
  var wantText = $('cWant').selectedOptions[0].text;
  var page = industry ? '\nSent from the ' + industry + ' page' : '';
  var body = 'Name: ' + f('cName') + '\nBusiness: ' + f('cBiz') + '\nEmail: ' + f('cEmail') + '\nType: ' + f('cType') + '\nWould like: ' + wantText + page + '\n\n' + f('cMsg');
  window.location.href = 'mailto:' + CONTACT_EMAIL + '?subject=' + encodeURIComponent('AnswerBay: ' + wantText + (industry ? ' (' + industry + ')' : '')) + '&body=' + encodeURIComponent(body);
});
if ($('yr')) $('yr').textContent = new Date().getFullYear();
