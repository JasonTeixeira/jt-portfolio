/* read-aloud.js — an "AI voice reads it back" option for generated text (quotes, plans, pipeline
   notes). Any button with class `ra-btn` and `data-read-target="#selector"` becomes a toggle that
   speaks the target element's text aloud with the browser's speech engine, in the page's language
   (en/es/pt). Instant, works on any dynamic text, free. Degrades to nothing if speech isn't
   supported. Re-scans briefly so buttons rendered by JS still get wired. */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  var d = document, cur = null;

  function label(btn, on) { var s = btn.querySelector('.ra-lbl'); if (s) s.textContent = on ? (btn.dataset.stopLabel || 'Stop') : (btn.dataset.label || 'Read aloud'); }
  function stop() { try { window.speechSynthesis.cancel(); } catch (e) {} if (cur) { cur.classList.remove('ra-on'); label(cur, false); } cur = null; }
  function pickVoice(lang) {
    var vs = window.speechSynthesis.getVoices() || [];
    return vs.filter(function (v) { return v.lang && v.lang.toLowerCase().slice(0, 2) === lang; })[0]
      || vs.filter(function (v) { return /^en/i.test(v.lang); })[0] || null;
  }
  function langOf(el) { var n = el.closest('[lang]') || d.documentElement; return (n.getAttribute('lang') || 'en').slice(0, 2).toLowerCase(); }

  function wire(btn) {
    if (btn.dataset.raWired) return; btn.dataset.raWired = '1';
    if (!btn.querySelector('.ra-lbl')) {
      var txt = (btn.textContent || 'Read aloud').trim();
      btn.dataset.label = txt; btn.dataset.stopLabel = btn.dataset.stopLabel || 'Stop';
      btn.textContent = '';
      var ic = d.createElement('span'); ic.setAttribute('aria-hidden', 'true'); ic.textContent = '🔊 ';
      var s = d.createElement('span'); s.className = 'ra-lbl'; s.textContent = txt;
      btn.appendChild(ic); btn.appendChild(s);
    }
    btn.setAttribute('type', 'button');
    btn.addEventListener('click', function () {
      var tgt = d.querySelector(btn.dataset.readTarget); if (!tgt) return;
      if (cur === btn) { stop(); return; }
      stop();
      var text = (tgt.innerText || tgt.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 5000);
      if (!text) { label(btn, false); return; }
      var u = new window.SpeechSynthesisUtterance(text.replace(/[—…]/g, ' '));
      var v = pickVoice(langOf(tgt)); if (v) u.voice = v;
      u.rate = 1.0; u.onend = stop; u.onerror = stop;
      cur = btn; btn.classList.add('ra-on'); label(btn, true);
      try { window.speechSynthesis.speak(u); } catch (e) { stop(); }
    });
  }

  function scan() { d.querySelectorAll('.ra-btn[data-read-target]').forEach(wire); }
  if (d.readyState !== 'loading') scan(); else d.addEventListener('DOMContentLoaded', scan);
  // Voices can load late; and some buttons are rendered by JS — re-scan a few times.
  try { window.speechSynthesis.onvoiceschanged = scan; } catch (e) {}
  var n = 0, iv = setInterval(function () { scan(); if (++n > 16) clearInterval(iv); }, 500);
})();
