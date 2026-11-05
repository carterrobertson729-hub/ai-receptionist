/* Setup form page: shows the plan the customer chose and the sections that fit their kind of business. */
(function(){
  var form = $('setupForm'); if (!form) return;
  var plan = query.get('plan') || '', cyc = query.get('cycle') || '', addons = query.get('addons') || '';
  var banner = $('planBanner');
  if (planById(plan)) { banner.textContent = 'Your plan: ' + planById(plan).name + ' (' + (cyc === 'yearly' ? 'yearly' : 'monthly') + ')' + (addons ? ' with ' + addons : '') + '.'; banner.hidden = false; }
  var always = plan.indexOf('always') === 0; var r = document.querySelector('input[name="answer_mode"][value="' + (always ? 'main_line' : 'backup') + '"]'); if (r && planById(plan)) r.checked = true;
  $('sPlan').value = plan; $('sCycle').value = cyc; $('sAddons').value = addons;

  function toggle(){
    var t = $('cType').value, kind = t.indexOf('Barber') === 0 ? 'barbershop' : (t.indexOf('Plumbing') === 0 ? 'trades' : '');
    document.querySelectorAll('[data-for]').forEach(function(s){ s.hidden = s.getAttribute('data-for') !== kind; });
  }
  $('cType').addEventListener('change', toggle); toggle();

  // a day marked Closed clears its times
  document.querySelectorAll('.hrow input[type="checkbox"]').forEach(function(c){
    c.addEventListener('change', function(){ var row = c.closest('.hrow'); row.querySelectorAll('input[data-time]').forEach(function(i){ i.disabled = c.checked; if (c.checked) i.value = ''; }); });
  });
})();


/* Setup form extras: typed-or-picked times, an Autofill button for the hours, and "what is it?" follow-ups. */
(function(){
  var form = $('setupForm'); if (!form) return;

  // ---- times: accept what people type (9, 9am, 9:30 pm, 930, 21:00) and show it as 9:30 AM ----
  function normalizeTime(raw, isClose){
    var v = String(raw || '').trim().toLowerCase().replace(/\./g, '');
    if (!v) return '';
    var m = /^(\d{1,2})(?::?(\d{2}))?\s*(a|p)?m?$/.exec(v);
    if (!m) return null;
    var h = parseInt(m[1], 10), min = m[2] ? parseInt(m[2], 10) : 0, ap = m[3] || '';
    if (min > 59 || h > 24) return null;
    if (!ap) {
      if (h >= 13 && h <= 23) { ap = 'p'; h -= 12; }
      else if (h === 0 || h === 24) { ap = 'a'; h = 12; }
      else if (h === 12) ap = 'p';
      else if (isClose) ap = 'p';                       // "5" as a closing time means 5 PM
      else ap = (h >= 5 ? 'a' : 'p');                    // "9" as an opening time means 9 AM
    } else if (h < 1 || h > 12) return null;
    return h + ':' + (min < 10 ? '0' : '') + min + ' ' + (ap === 'a' ? 'AM' : 'PM');
  }
  var note = $('hoursNote');
  function checkTime(input){
    var isClose = /_close$/.test(input.name);
    var out = normalizeTime(input.value, isClose);
    if (out === null) { input.setCustomValidity('Please type a time like 9:00 AM'); input.classList.add('bad'); if (note) note.hidden = false; return false; }
    input.setCustomValidity(''); input.classList.remove('bad');
    if (out) input.value = out;
    if (note && !form.querySelector('input[data-time].bad')) note.hidden = true;
    return true;
  }

  // ---- Autofill button: appears on the first day that has both times; goes away if they start filling other days ----
  var rows = Array.prototype.slice.call(form.querySelectorAll('.hrow'));
  var source = null, btn = null, dismissed = false;
  function timesOf(row){ var t = row.querySelectorAll('input[data-time]'); return [t[0].value.trim(), t[1].value.trim()]; }
  function removeBtn(){ if (btn && btn.parentNode) btn.parentNode.removeChild(btn); btn = null; }
  function refreshBtn(){
    if (dismissed) { removeBtn(); return; }
    if (!source) {
      for (var i = 0; i < rows.length; i++) { var t = timesOf(rows[i]); if (t[0] && t[1] && !rows[i].querySelector('input[type="checkbox"]').checked && !rows[i].querySelector('input.bad')) { source = rows[i]; break; } }
    }
    if (!source) return;
    var st = timesOf(source);
    if (!(st[0] && st[1]) || source.querySelector('input.bad')) { removeBtn(); return; }
    if (!btn) {
      btn = document.createElement('button'); btn.type = 'button'; btn.className = 'btn btn-ghost autofill'; btn.textContent = 'Autofill the other days with these times';
      btn.addEventListener('click', function(){
        var st2 = timesOf(source);
        rows.forEach(function(r){
          if (r === source) return;
          var closed = r.querySelector('input[type="checkbox"]'); if (closed.checked) return;
          var t = r.querySelectorAll('input[data-time]'); if (t[0].value.trim() || t[1].value.trim()) return;
          t[0].value = st2[0]; t[1].value = st2[1];
        });
        dismissed = true; removeBtn();
      });
      source.appendChild(btn);
    }
  }
  rows.forEach(function(r){
    r.querySelectorAll('input[data-time]').forEach(function(inp){
      inp.addEventListener('change', function(){ checkTime(inp); refreshBtn(); });
      inp.addEventListener('input', function(){
        if (r !== source && source && inp.value.trim()) { dismissed = true; removeBtn(); }   // they are typing the other days themselves
        else if (r === source) refreshBtn();
      });
      inp.addEventListener('blur', function(){ checkTime(inp); });
    });
    r.querySelector('input[type="checkbox"]').addEventListener('change', function(){ if (r === source) { source = null; removeBtn(); } refreshBtn(); });
  });
  form.addEventListener('submit', function(){ form.querySelectorAll('input[data-time]').forEach(checkTime); }, true);

  // ---- "Something else" / "Other": show a follow-up question; hide and clear it when they pick a normal choice ----
  document.querySelectorAll('[data-other-for]').forEach(function(box){
    var sel = $(box.getAttribute('data-other-for')); if (!sel) return;
    var input = box.querySelector('input');
    function update(){
      var picked = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '';
      var show = /^(something else|other)$/i.test(picked.trim());
      box.hidden = !show;
      if (!show) input.value = '';
    }
    sel.addEventListener('change', update); update();
  });
})();


/* Break between appointments: start with a sensible choice for the type of business, unless they already picked one. */
(function(){
  var type = $('cType'), gap = $('sGap'); if (!type || !gap) return;
  var touched = false;
  gap.addEventListener('change', function(){ touched = true; });
  function suggest(){
    if (touched) return;
    var t = type.value;
    gap.value = t.indexOf('Barber') === 0 ? 'none' : (t.indexOf('Plumbing') === 0 ? '30 minutes' : 'Not sure');
  }
  type.addEventListener('change', suggest); suggest();
})();


/* Payment reference: the emailed setup link carries ?ref=... so the answers can be matched to the payment. */
(function(){
  var form = $('setupForm'); if (!form) return;
  var ref = (query.get('ref') || '').slice(0, 120);
  if ($('sRef')) $('sRef').value = ref;
  if (!ref && $('refBanner')) $('refBanner').hidden = false;
})();
