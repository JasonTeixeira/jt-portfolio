/* icons.js — line-icon set for JT Portfolio.
   Replaces pictographic emoji with consistent 24-grid stroke icons.
   Usage: icon('chat')  or  icon('chat', '#a78bfa', 20)
   Returns an <svg> string safe to drop into innerHTML. */
(function (w) {
  var P = {
    /* — AI Build — */
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="14" y2="17"/>',
    copilot: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/>',
    search: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    nodes: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><line x1="8.2" y1="10.8" x2="15.8" y2="7.2"/><line x1="8.2" y1="13.2" x2="15.8" y2="16.8"/>',
    plug: '<path d="M12 22v-4"/><path d="M9 2v5"/><path d="M15 2v5"/><path d="M7 7h10v2a5 5 0 0 1-5 5 5 5 0 0 1-5-5z"/>',
    /* — Eval & QA — */
    scale: '<path d="M12 4v17"/><path d="M7 21h10"/><path d="M12 4l-6 2m6-2l6 2"/><path d="M6 6l-3 6a3 3 0 0 0 6 0z"/><path d="M18 6l-3 6a3 3 0 0 0 6 0z"/>',
    shield: '<path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z"/>',
    gauge: '<path d="M4 16a8 8 0 1 1 16 0"/><line x1="12" y1="16" x2="16" y2="10"/><circle cx="12" cy="16" r="1.2"/>',
    anchor: '<circle cx="12" cy="5" r="2.5"/><line x1="12" y1="7.5" x2="12" y2="21"/><path d="M5 12a7 7 0 0 0 14 0"/><line x1="5" y1="12" x2="3" y2="12"/><line x1="19" y1="12" x2="21" y2="12"/>',
    repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
    activity: '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
    /* — Test Automation — */
    e2e: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><path d="M10 12.5l4.5 2.8-4.5 2.7z"/>',
    link: '<path d="M9 15l6-6"/><path d="M11 6l1-1a3.5 3.5 0 0 1 5 5l-1 1"/><path d="M13 18l-1 1a3.5 3.5 0 0 1-5-5l1-1"/>',
    mobile: '<rect x="7" y="2" width="10" height="20" rx="2"/><line x1="11" y1="18" x2="13" y2="18"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>',
    bandage: '<path d="M14.5 3.5l6 6a3 3 0 0 1 0 4.2l-6.8 6.8a3 3 0 0 1-4.2 0l-6-6a3 3 0 0 1 0-4.2l6.8-6.8a3 3 0 0 1 4.2 0z"/><line x1="9" y1="9" x2="9" y2="9.01"/><line x1="12" y1="12" x2="12" y2="12.01"/><line x1="15" y1="15" x2="15" y2="15.01"/>',
    zap: '<path d="M13 2 4 14h7l-1 8 10-13h-7z"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>',
    a11y: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="7.5" r="1.2"/><path d="M7 10h10"/><path d="M12 10v5"/><path d="M12 15l-2.5 5"/><path d="M12 15l2.5 5"/>',
    /* — Automation — */
    workflow: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><path d="M6.5 10v4a3 3 0 0 0 3 3H14"/>',
    magnet: '<path d="M6 4v7a6 6 0 0 0 12 0V4"/><line x1="6" y1="4" x2="10" y2="4"/><line x1="14" y1="4" x2="18" y2="4"/><line x1="6" y1="11" x2="10" y2="11"/><line x1="14" y1="11" x2="18" y2="11"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6a8 3 0 0 0 16 0V5"/><path d="M4 11v6a8 3 0 0 0 16 0v-6"/>',
    puzzle: '<path d="M9 3.5a2 2 0 0 1 4 0c0 .8.5 1 1 1h3a1 1 0 0 1 1 1v3c0 .5.2 1 1 1a2 2 0 0 1 0 4c-.8 0-1 .5-1 1v3a1 1 0 0 1-1 1h-3c-.5 0-1 .2-1 1a2 2 0 0 1-4 0c0-.8-.5-1-1-1H5a1 1 0 0 1-1-1v-3c0-.8-.5-1-1-1a2 2 0 0 1 0-4c.5 0 1-.2 1-1V5.5a1 1 0 0 1 1-1h3c.8 0 1-.5 1-1z"/>',
    broadcast: '<path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    /* — Product — */
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><line x1="8" y1="20" x2="16" y2="20"/><line x1="12" y1="16" x2="12" y2="20"/>',
    tools: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
    server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><line x1="7" y1="7.5" x2="7.01" y2="7.5"/><line x1="7" y1="16.5" x2="7.01" y2="16.5"/>',
    bars: '<line x1="4" y1="20" x2="4" y2="12"/><line x1="10" y1="20" x2="10" y2="4"/><line x1="16" y1="20" x2="16" y2="9"/><line x1="21" y1="20" x2="3" y2="20"/>',
    /* — extra (demos) — */
    voice: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="9" y1="22" x2="15" y2="22"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    flask: '<path d="M9 2h6"/><path d="M10 2v6l-5 9a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 17l-5-9V2"/><line x1="7" y1="15" x2="17" y2="15"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
    menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>'
  };
  function icon(name, color, size) {
    var d = P[name];
    if (!d) return '';
    var s = size || 18;
    return '<svg class="ico" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="' +
      (color || 'currentColor') + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      d + '</svg>';
  }
  w.ICONS = P;
  w.icon = icon;
})(window);
