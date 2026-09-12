/* receipt-modal.js — open the verbatim run captures inline instead of navigating away.
   Progressive enhancement: the links are real <a href="captures/...">, so no-JS and
   cmd/ctrl/middle-click still open the page in a tab. With JS + a plain click, the
   capture loads in an on-brand lightbox (same-origin iframe) so the proof appears
   without losing the case-study context. ESC / backdrop / × closes; reduced-motion aware.
*/
(function () {
  var d = document, w = window; window.__rcInit=1;
  // NOTE: no webdriver gate here — this is a harmless progressive enhancement (a bot or
  // crawler just follows the real href to the capture page), and gating it would disable
  // it in automated tests too.
  var SEL = 'a[href^="captures/"], a[href^="/captures/"]';
  var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var overlay, frame, lastFocus;

  function close() {
    if (!overlay) return;
    overlay.style.opacity = '0';
    var o = overlay; overlay = null;
    setTimeout(function () { if (o && o.parentNode) o.parentNode.removeChild(o); }, reduce ? 0 : 220);
    d.removeEventListener('keydown', onKey);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* ignore */ } }
  }
  function onKey(e) { if (e.key === 'Escape') close(); }

  function open(href, title) {
    lastFocus = d.activeElement;
    overlay = d.createElement('div');
    overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', title || 'Run capture');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:200;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(12px,3vw,40px);background:rgba(6,6,8,0.82);backdrop-filter:blur(6px);opacity:0;transition:opacity ' + (reduce ? '0s' : '.22s ease');
    var shell = d.createElement('div');
    shell.style.cssText = 'width:min(1100px,100%);height:min(86vh,100%);display:flex;flex-direction:column;background:#0C0C0E;border:1px solid #2A2826;border-radius:14px;overflow:hidden;box-shadow:0 30px 80px -20px rgba(0,0,0,0.8);transform:' + (reduce ? 'none' : 'translateY(8px) scale(0.99)') + ';transition:transform .3s cubic-bezier(.16,1,.3,1)';
    var bar = d.createElement('div');
    bar.style.cssText = 'flex-shrink:0;display:flex;align-items:center;gap:12px;padding:11px 14px;border-bottom:1px solid #211F1C;background:#09090B';
    bar.innerHTML =
      '<span style="width:10px;height:10px;border-radius:50%;background:#10b981;flex-shrink:0;box-shadow:0 0 8px #10b981"></span>' +
      '<span style="font-family:\'JetBrains Mono\',monospace;font-size:12px;color:#F4F2EF;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (title || 'verbatim run') + '</span>' +
      '<a class="jt-rc-open" href="' + href + '" target="_blank" rel="noopener" style="font-family:\'JetBrains Mono\',monospace;font-size:11px;color:#22d3ee;text-decoration:none;white-space:nowrap">open in a tab ↗</a>' +
      '<button type="button" class="jt-rc-x" aria-label="Close" style="background:transparent;border:none;color:#8E8882;font-size:20px;line-height:1;cursor:pointer;padding:2px 6px">&times;</button>';
    frame = d.createElement('iframe');
    frame.src = href; frame.title = title || 'Run capture';
    frame.style.cssText = 'flex:1;width:100%;border:0;background:#0C0C0E';
    frame.setAttribute('loading', 'eager');
    shell.appendChild(bar); shell.appendChild(frame);
    overlay.appendChild(shell); d.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.style.opacity = '1'; shell.style.transform = 'none'; });
    bar.querySelector('.jt-rc-x').addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    d.addEventListener('keydown', onKey);
    setTimeout(function () { bar.querySelector('.jt-rc-x').focus(); }, 60);
    if (w.plausible) { try { w.plausible('receipt-open', { props: { capture: href } }); } catch (e) { /* ignore */ } }
  }

  // Capture phase so we intercept BEFORE any bubbling handler (site nav, smooth-scroll)
  // can stopPropagation or the browser starts navigating.
  d.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var t = e.target;
    var a = (t && t.closest) ? t.closest(SEL) : null;
    if (!a) return;
    e.preventDefault(); e.stopPropagation();
    open(a.getAttribute('href'), (a.textContent || '').replace(/^▸\s*/, '').trim());
  }, true);
})();
