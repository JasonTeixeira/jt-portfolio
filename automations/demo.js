/* Sage Automations demo microsite — interactive demos + personalization.
   Vanilla JS, no deps. Personalize a prospect's link with ?biz=Their+Business */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, reduce ? Math.min(ms, 120) : ms); }); };

  // ── personalization ──────────────────────────────────────────────
  var params = new URLSearchParams(location.search);
  var rawBiz = (params.get('biz') || '').replace(/[<>]/g, '').slice(0, 60).trim();
  var biz = rawBiz || 'your business';
  var bizShort = rawBiz ? rawBiz.split(/\s+/).slice(0, 2).join(' ') : 'you';
  $$('[data-biz]').forEach(function (n) { n.textContent = biz; });
  var line = $('[data-biz-line]');
  if (line && rawBiz) line.textContent = 'Prepared for ' + biz;
  if (rawBiz) document.title = biz + ' — never lose another job to a missed call';

  // ── helpers to render phone messages ─────────────────────────────
  function bubble(screen, cls, text) {
    var d = document.createElement('div');
    d.className = 'msg ' + cls;
    d.textContent = text;
    screen.appendChild(d);
    screen.scrollTop = screen.scrollHeight;
    return d;
  }
  function typing(screen) {
    var d = document.createElement('div');
    d.className = 'typing';
    d.innerHTML = '<i></i><i></i><i></i>';
    screen.appendChild(d);
    screen.scrollTop = screen.scrollHeight;
    return d;
  }
  function clear(screen) { while (screen.firstChild) screen.removeChild(screen.firstChild); }

  // ── DEMO 1: missed-call text-back ────────────────────────────────
  var mcPlay = $('#mc-play'), mcReplay = $('#mc-replay'), mcNote = $('#mc-note');
  var cust = $('#cust-screen'), owner = $('#owner-screen');
  var mcRunning = false;

  async function runMissedCall() {
    if (mcRunning) return;
    mcRunning = true;
    mcPlay.disabled = true; mcPlay.hidden = true; mcReplay.hidden = true;
    clear(cust); clear(owner);

    // incoming call rings out
    var card = document.createElement('div');
    card.className = 'callcard ringing';
    card.innerHTML = '<div class="ring">📞</div><div class="who">' + esc(bizShort) + '</div><div class="state">Calling…</div>';
    cust.appendChild(card);
    await wait(2200);
    card.className = 'callcard missed';
    card.querySelector('.ring').textContent = '📵';
    card.querySelector('.state').textContent = 'Missed — went to voicemail';
    mcNote.textContent = 'Old way: that customer just hung up and called the next name on the list.';
    await wait(1400);

    // the save: instant text-back
    clear(cust);
    bubble(cust, 'sys', 'Text from ' + bizShort);
    var t = typing(cust); await wait(900); t.remove();
    bubble(cust, 'them', 'Hi! Thanks for calling ' + biz + '. Sorry we missed you — what do you need help with? I can get you booked right now. 👋');
    // owner gets pinged
    bubble(owner, 'sys', 'Sage · lead alert');
    bubble(owner, 'alert', '🔔 Recovered a missed call — replying to the customer now. Sit tight, I\'ll text you when it\'s booked.');
    await wait(1600);

    bubble(cust, 'you', 'my water heater\'s leaking bad, need someone today if possible');
    await wait(700);
    var t2 = typing(cust); await wait(1100); t2.remove();
    bubble(cust, 'them', 'Got it — a leaking water heater, same-day. We can do a 2–4pm window today. What\'s the service address?');
    await wait(1500);
    bubble(cust, 'you', '123 Oak St. 2–4 works great');
    await wait(700);
    var t3 = typing(cust); await wait(1000); t3.remove();
    bubble(cust, 'them', 'Perfect — you\'re booked for 2–4pm today at 123 Oak St. You\'ll get a confirmation text shortly. 👍');
    // owner booked alert
    bubble(owner, 'alert', '✅ Booked: Water heater leak · 123 Oak St · today 2–4pm. Added to your calendar. That\'s a job you almost lost.');
    await wait(600);
    mcNote.textContent = 'A job you would have lost — recovered and booked automatically, while you were on another call.';
    mcReplay.hidden = false; mcRunning = false;
  }
  if (mcPlay) mcPlay.addEventListener('click', runMissedCall);
  if (mcReplay) mcReplay.addEventListener('click', runMissedCall);

  // ── DEMO 2: speed-to-lead ────────────────────────────────────────
  var stlBtn = $('#stl-submit'), stlRace = $('#stl-race'), stlYou = $('#stl-you'), stlYouMsg = $('#stl-you-msg');
  if (stlBtn) stlBtn.addEventListener('click', async function () {
    stlBtn.disabled = true; stlBtn.textContent = 'Sending…';
    await wait(500);
    stlRace.hidden = false;
    var secs = 0;
    stlYou.textContent = '0.0s';
    var iv = setInterval(function () { secs += 0.1; stlYou.textContent = secs.toFixed(1) + 's'; }, 60);
    await wait(reduce ? 200 : 900);
    clearInterval(iv);
    stlYou.textContent = '8 seconds';
    stlYouMsg.textContent = '“Hi Jordan — saw your AC request. We can be out today. What time works?” Sent by text + email.';
    stlBtn.textContent = 'Contacted ✓';
  });

  // ── DEMO 3: review engine ────────────────────────────────────────
  var revBtn = $('#rev-play'), revSteps = $('#rev-steps'), revStars = $('#rev-stars'),
      revRating = $('#rev-rating'), revCount = $('#rev-count');
  var revState = { rating: 4.2, count: 38, running: false };
  var STEPS = [
    { ic: '🔧', t: 'Job marked complete in your system' },
    { ic: '💬', t: 'Customer gets a friendly text: “Thanks! Mind leaving a quick review?”' },
    { ic: '⭐', t: 'One tap → straight to your Google review page' },
    { ic: '📈', t: 'New 5-star review posted — you climb the local rankings' }
  ];
  if (revBtn) revBtn.addEventListener('click', async function () {
    if (revState.running) return;
    revState.running = true; revBtn.disabled = true;
    revSteps.innerHTML = '';
    var els = STEPS.map(function (s) {
      var d = document.createElement('div');
      d.className = 'rev-step';
      d.innerHTML = '<span class="rs-ic">' + s.ic + '</span><span>' + s.t + '</span>';
      revSteps.appendChild(d);
      return d;
    });
    for (var i = 0; i < els.length; i++) { await wait(750); els[i].classList.add('on'); }
    await wait(500);
    revState.count += 1;
    revState.rating = Math.min(5, revState.rating + 0.1);
    revStars.textContent = '★★★★★';
    revRating.textContent = revState.rating.toFixed(1);
    revCount.textContent = revState.count;
    revBtn.disabled = false; revBtn.textContent = '▶ Complete another job';
    revState.running = false;
  });

  // ── DEMO 4: ROI slider ───────────────────────────────────────────
  var range = $('#roi-range'), roiVal = $('#roi-val');
  var answered = $('#roi-answered'), recovered = $('#roi-recovered'), jobs = $('#roi-jobs'), rev = $('#roi-rev');
  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function animateTo(el, target, fmt) {
    var start = parseFloat((el.textContent || '0').replace(/[^0-9.]/g, '')) || 0;
    var t0 = null, dur = reduce ? 0 : 500;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = dur ? Math.min(1, (ts - t0) / dur) : 1;
      var v = start + (target - start) * (1 - Math.pow(1 - p, 3));
      el.textContent = fmt ? fmt(v) : Math.round(v);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function recalcRoi() {
    var job = parseInt(range.value, 10);
    roiVal.textContent = job.toLocaleString('en-US');
    // conservative model: fixed monthly call volume, recovery + conversion rates
    var answeredN = 190;            // calls handled 24/7 in a month
    var recoveredN = 34;            // missed calls the system saved
    var jobsN = Math.round(recoveredN * 0.55); // ~55% of recovered become jobs
    var revenue = jobsN * job;
    animateTo(answered, answeredN);
    animateTo(recovered, recoveredN);
    animateTo(jobs, jobsN);
    animateTo(rev, revenue, money);
  }
  if (range) {
    range.addEventListener('input', recalcRoi);
    recalcRoi();
  }

  // ── booking modal ────────────────────────────────────────────────
  var modal = $('#book-modal'), modalX = $('#modal-x'), form = $('#book-form'), status = $('#book-status');
  function openModal(e) { if (e) e.preventDefault(); modal.hidden = false; document.body.style.overflow = 'hidden'; var f = $('input', modal); if (f) setTimeout(function () { f.focus(); }, 30); }
  function closeModal() { modal.hidden = true; document.body.style.overflow = ''; }
  $$('[data-book]').forEach(function (b) { b.addEventListener('click', openModal); });
  if (modalX) modalX.addEventListener('click', closeModal);
  if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal && !modal.hidden) closeModal(); });

  if (form) form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var btn = $('button', form); btn.disabled = true; btn.textContent = 'Sending…';
    status.className = 'modal-status'; status.textContent = '';
    var data = {};
    $$('input', form).forEach(function (i) { data[i.name] = i.value; });
    try {
      // Reuse the site's lead endpoint (degrade-safe). Tag the source + business.
      await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email || (data.phone + '@lead.local'),
          name: data.name,
          source: 'automations-demo',
          meta: { business: data.business || biz, phone: data.phone, page: 'automations' }
        })
      }).catch(function () {});
      status.className = 'modal-status ok';
      status.textContent = 'Got it, ' + (data.name ? data.name.split(' ')[0] : 'thanks') + '! We\'ll reach out within one business day to set up your live demo.';
      form.reset();
    } catch (err) {
      status.className = 'modal-status ok';
      status.textContent = 'Got it! We\'ll be in touch within one business day.';
    }
    btn.disabled = false; btn.textContent = 'Request my demo →';
  });

  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }

  // auto-play the hero demo when it scrolls into view (once)
  if ('IntersectionObserver' in window && mcPlay && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { io.disconnect(); setTimeout(runMissedCall, 400); }
      });
    }, { threshold: 0.4 });
    io.observe($('#mc-stage'));
  }
})();
