/* Checkout page: choose plan, billing period and add-ons, see the total, then pay (Stripe link) or reserve. */
(function(){
  var box = $('checkout'); if (!box) return;
  var q = new URLSearchParams(window.location.search);
  var state = { plan: planById(q.get('plan')) ? q.get('plan') : 'backup-standard', cycle: q.get('cycle') === 'yearly' ? 'yearly' : 'monthly', addons: {} };

  // plan picker and add-ons
  $('coPlan').innerHTML = ['backup', 'always'].map(function(m){
    return '<optgroup label="' + MODES[m].label + '">' + PLANS.filter(function(p){ return p.mode === m; }).map(function(p){
      return '<option value="' + p.id + '">' + p.name + ' (' + p.minutes.toLocaleString('en-US') + ' minutes, ' + money(p.monthly) + '/month)</option>'; }).join('') + '</optgroup>';
  }).join('');
  $('coPlan').value = state.plan;
  $('coAddons').innerHTML = ADDONS.map(function(a){
    return '<label class="addon"><input type="checkbox" id="ad-' + a.id + '" value="' + a.id + '"><span><strong>' + a.name + '</strong> +' + money(a.monthly) + '/month' + (a.setup ? ', setup +' + money(a.setup) : '') +
      (a.soon ? ' <span class="badge-soon">Launching soon</span>' : '') + '<br><small>' + a.text + '</small></span></label>';
  }).join('');

  function recompute(){
    state.plan = $('coPlan').value;
    var plan = planById(state.plan), addons = ADDONS.filter(function(a){ return $('ad-' + a.id).checked; });
    var monthly = plan.monthly + addons.reduce(function(t, a){ return t + a.monthly; }, 0);
    var yearly = Math.floor(monthly * 12 * (1 - DISCOUNT));
    var recurring = state.cycle === 'yearly' ? yearly : monthly;
    var setup = SETUP_FEE + addons.reduce(function(t, a){ return t + a.setup; }, 0);
    var today = recurring + setup;

    $('bMonthly').setAttribute('aria-pressed', state.cycle === 'monthly');
    $('bYearly').setAttribute('aria-pressed', state.cycle === 'yearly');
    var rows = '<div class="line"><span>' + plan.name + ' plan (' + plan.minutes.toLocaleString('en-US') + ' minutes)</span><b>' + money(plan.monthly) + '/mo</b></div>' +
      addons.map(function(a){ return '<div class="line"><span>' + a.name + '</span><b>+' + money(a.monthly) + '/mo</b></div>'; }).join('') +
      (state.cycle === 'yearly' ? '<div class="line"><span>Yearly plan: 10% off, billed once a year</span><b>' + money(yearly) + '/yr</b></div>' : '') +
      '<div class="line"><span>One-time setup</span><b>' + money(SETUP_FEE) + '</b></div>' +
      addons.filter(function(a){ return a.setup; }).map(function(a){ return '<div class="line"><span>' + a.name + ' setup</span><b>+' + money(a.setup) + '</b></div>'; }).join('');
    $('coLines').innerHTML = rows;
    $('coToday').textContent = money(today);
    $('coRecurring').textContent = money(recurring) + (state.cycle === 'yearly' ? ' every year' : ' every month') + ' after that';

    $('fPlan').value = plan.name; $('fCycle').value = state.cycle;
    $('fAddons').value = addons.map(function(a){ return a.name; }).join(', ') || 'none';
    $('fTotal').value = money(today) + ' today, then ' + money(recurring) + (state.cycle === 'yearly' ? '/year' : '/month');
    updatePay(plan, addons);
  }

  function updatePay(plan, addons){
    var link = CHECKOUT_LINKS[plan.id] && CHECKOUT_LINKS[plan.id][state.cycle];
    var agreed = $('coAgree').checked;
    var pay = $('payLink'), reserve = $('reserveBox');
    if (link) {
      reserve.hidden = true; pay.hidden = false;
      var ref = [plan.id, state.cycle].concat(addons.map(function(a){ return a.id; })).concat($('coNotify').checked ? ['notify'] : []).join('_');
      pay.href = link + (link.indexOf('?') === -1 ? '?' : '&') + 'client_reference_id=' + encodeURIComponent(ref);
      pay.classList.toggle('disabled', !agreed); pay.setAttribute('aria-disabled', !agreed);
      $('payNote').textContent = addons.length ? 'The secure payment page covers the plan and setup. We add your add-ons to your subscription during setup.' : 'You will pay on a secure payment page.';
    } else {
      pay.hidden = true; reserve.hidden = false;
    }
  }

  $('coPlan').onchange = recompute;
  ADDONS.forEach(function(a){ $('ad-' + a.id).onchange = recompute; });
  $('bMonthly').onclick = function(){ state.cycle = 'monthly'; recompute(); };
  $('bYearly').onclick = function(){ state.cycle = 'yearly'; recompute(); };
  $('coAgree').onchange = recompute;
  $('coNotify').onchange = recompute;
  $('payLink').addEventListener('click', function(e){ if (!$('coAgree').checked) { e.preventDefault(); $('coAgree').focus(); $('coAgreeNote').textContent = 'You must tick this box to agree to the terms and policies before you can continue.'; $('coAgreeNote').className = 'err'; } });
  $('coAgree').addEventListener('change', function(){ if ($('coAgree').checked) { $('coAgreeNote').textContent = ''; } });

  // reserving a plan (used until online payment is switched on)
  var form = $('orderForm'); form.setAttribute('data-custom', '');
  form.addEventListener('submit', function(e){
    e.preventDefault();
    if (!$('coAgree').checked) { $('coAgree').focus(); $('coAgreeNote').textContent = 'You must tick this box to agree to the terms and policies before you can continue.'; $('coAgreeNote').className = 'err'; return; }
    if (!form.checkValidity()) { form.reportValidity(); return; }
    sendForm(form, function(){
      form.hidden = true;
      var link = $('setupLink'), ad = ADDONS.filter(function(a){ return $('ad-' + a.id).checked; }).map(function(a){ return a.name; }).join(', ');
      if (link) link.href = 'setup.html?plan=' + encodeURIComponent(state.plan) + '&cycle=' + state.cycle + (ad ? '&addons=' + encodeURIComponent(ad) : '');
      $('orderDone').hidden = false; $('orderDone').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  recompute();
})();
