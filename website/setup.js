/* Setup form page: shows the plan the customer chose and the sections that fit their kind of business. */
(function(){
  var form = $('setupForm'); if (!form) return;
  var plan = query.get('plan') || '', cyc = query.get('cycle') || '', addons = query.get('addons') || '';
  var banner = $('planBanner');
  if (plan === 'trial') { banner.textContent = 'Your free trial: the first 50 minutes of calls are free.'; banner.hidden = false; }
  else if (planById(plan)) { banner.textContent = 'Your plan: ' + planById(plan).name + ' (' + (cyc === 'yearly' ? 'yearly' : 'monthly') + ')' + (addons ? ' with ' + addons : '') + '.'; banner.hidden = false; }
  $('sPlan').value = plan; $('sCycle').value = cyc; $('sAddons').value = addons;

  function toggle(){
    var t = $('cType').value, kind = t.indexOf('Barber') === 0 ? 'barbershop' : (t.indexOf('Plumbing') === 0 ? 'trades' : '');
    document.querySelectorAll('[data-for]').forEach(function(s){ s.hidden = s.getAttribute('data-for') !== kind; });
  }
  $('cType').addEventListener('change', toggle); toggle();

  // a day marked Closed clears its times
  document.querySelectorAll('.hrow input[type="checkbox"]').forEach(function(c){
    c.addEventListener('change', function(){ var row = c.closest('.hrow'); row.querySelectorAll('input[type="time"]').forEach(function(i){ i.disabled = c.checked; if (c.checked) i.value = ''; }); });
  });
})();
