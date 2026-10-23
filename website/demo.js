/* Book-a-demo calendar. Edit the settings below to change when demos can be booked. */
var DEMO = {
  minutes: 20,                    // length of the call
  tz: 'America/Chicago',          // the time zone the hours below are in
  tzLabel: 'Central Time',
  days: [1, 2, 3, 4, 5],          // 0 = Sunday ... 6 = Saturday
  start: '10:00', end: '17:00',   // first start and the time the last call must finish by
  stepMinutes: 30,                // a new slot every 30 minutes
  noticeHours: 24,                // earliest booking, from now
  daysAhead: 45                   // how far ahead people can book
};

(function(){
  var calEl = $('calendar'); if (!calEl) return;
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  var selected = null, selectedTime = null;

  function zoneParts(ms, tz){
    var o = {};
    new Intl.DateTimeFormat('en-US', { timeZone: tz, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' })
      .formatToParts(new Date(ms)).forEach(function(p){ o[p.type] = p.value; });
    return o;
  }
  // The real moment in time when it is y-m-d hh:mm on the clock in the demo time zone
  function instant(y, m, d, hh, mm){
    var guess = Date.UTC(y, m - 1, d, hh, mm), p = zoneParts(guess, DEMO.tz);
    var asIfUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
    return guess - (asIfUtc - guess);
  }
  function pad(n){ return ('0' + n).slice(-2); }
  function key(y, m, d){ return y + '-' + pad(m) + '-' + pad(d); }
  function hm(s){ var p = s.split(':'); return +p[0] * 60 + +p[1]; }
  function label12(min){ var h = Math.floor(min / 60), m = min % 60, ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + pad(m) + ' ' + ap; }

  var now = Date.now(), t = zoneParts(now, DEMO.tz);
  var todayKey = key(+t.year, +t.month, +t.day);
  var view = { y: +t.year, m: +t.month };   // month on screen
  var earliest = now + DEMO.noticeHours * 3600000;
  var latest = now + DEMO.daysAhead * 86400000;

  function slotsFor(y, m, d){
    var dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (DEMO.days.indexOf(dow) === -1) return [];
    var out = [];
    for (var s = hm(DEMO.start); s + DEMO.minutes <= hm(DEMO.end); s += DEMO.stepMinutes) {
      var ms = instant(y, m, d, Math.floor(s / 60), s % 60);
      if (ms >= earliest && ms <= latest) out.push({ min: s, ms: ms });
    }
    return out;
  }

  function renderCalendar(){
    var first = new Date(Date.UTC(view.y, view.m - 1, 1)).getUTCDay();
    var days = new Date(Date.UTC(view.y, view.m, 0)).getUTCDate();
    var html = '<div class="cal-head"><button type="button" class="cal-nav" id="calPrev" aria-label="Previous month">&#8249;</button><h3>' + MONTHS[view.m - 1] + ' ' + view.y +
      '</h3><button type="button" class="cal-nav" id="calNext" aria-label="Next month">&#8250;</button></div><div class="cal-grid" role="grid">';
    DOW.forEach(function(n){ html += '<div class="cal-dow">' + n + '</div>'; });
    for (var i = 0; i < first; i++) html += '<div></div>';
    for (var d = 1; d <= days; d++) {
      var k = key(view.y, view.m, d), has = slotsFor(view.y, view.m, d).length > 0;
      html += '<button type="button" class="cal-day' + (k === selected ? ' sel' : '') + (k === todayKey ? ' today' : '') + '" data-day="' + k + '"' + (has ? '' : ' disabled') + '>' + d + '</button>';
    }
    calEl.innerHTML = html + '</div>';
    $('calPrev').onclick = function(){ view.m--; if (view.m < 1) { view.m = 12; view.y--; } renderCalendar(); };
    $('calNext').onclick = function(){ view.m++; if (view.m > 12) { view.m = 1; view.y++; } renderCalendar(); };
    calEl.querySelectorAll('.cal-day').forEach(function(b){ b.onclick = function(){ selected = b.getAttribute('data-day'); selectedTime = null; renderCalendar(); renderSlots(); updateSummary(); }; });
  }

  function prettyDay(k){
    var p = k.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }
  function renderSlots(){
    var box = $('slots');
    if (!selected) { box.innerHTML = '<p class="fine">Pick a day on the calendar to see the times.</p>'; return; }
    var p = selected.split('-'), slots = slotsFor(+p[0], +p[1], +p[2]);
    box.innerHTML = '<h3 style="margin-bottom:4px">' + prettyDay(selected) + '</h3><p class="fine" style="margin-bottom:12px">Pick a start time. Times are in ' + DEMO.tzLabel + '. Each call is ' + DEMO.minutes + ' minutes.</p><div class="slot-grid">' +
      slots.map(function(s){ return '<button type="button" class="slot' + (selectedTime === s.min ? ' sel' : '') + '" data-min="' + s.min + '" data-ms="' + s.ms + '">' + label12(s.min) + '</button>'; }).join('') + '</div>';
    box.querySelectorAll('.slot').forEach(function(b){ b.onclick = function(){ selectedTime = +b.getAttribute('data-min'); selectedMs = +b.getAttribute('data-ms'); renderSlots(); updateSummary(); }; });
  }
  var selectedMs = null;

  function updateSummary(){
    var sum = $('pickSummary'), ok = selected && selectedTime !== null;
    $('dDate').value = selected || ''; $('dTime').value = selectedTime !== null ? label12(selectedTime) + ' ' + DEMO.tzLabel : '';
    $('dLocal').value = '';
    if (!ok) { sum.innerHTML = 'No time picked yet.'; $('demoSubmit').disabled = true; return; }
    var local = new Date(selectedMs).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    $('dLocal').value = local;
    sum.innerHTML = '<strong>' + prettyDay(selected) + '</strong> at <strong>' + label12(selectedTime) + ' ' + DEMO.tzLabel + '</strong> (' + local + ' in your time zone), ' + DEMO.minutes + ' minutes.';
    $('demoSubmit').disabled = false;
  }

  renderCalendar(); renderSlots(); updateSummary();

  // submit with the picked time
  var form = $('demoForm');
  form.setAttribute('data-custom', '');
  form.addEventListener('submit', function(e){
    e.preventDefault();
    if (selected === null || selectedTime === null) { $('pickSummary').textContent = 'Please pick a day and a time first.'; return; }
    if (!form.checkValidity()) { form.reportValidity(); return; }
    sendForm(form, function(){
      form.hidden = true;
      var ok = $('demoDone');
      ok.querySelector('[data-when]').innerHTML = $('pickSummary').innerHTML;
      ok.hidden = false; ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });
})();
