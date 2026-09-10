// Operator marketing/outreach cockpit (module ④), backed by /api/marketing.
// Manual-assist: surfaces who needs a touch + a copy-ready opener; the operator
// sends and logs the touch (via /api/prospects). No auto cold-emailing.
import { rankLeads } from './lead-score.mjs';

const TIER = { hot: { c: '#f43f5e', t: '🔥 HOT' }, warm: { c: '#F59E0B', t: 'WARM' }, cool: { c: '#8E8882', t: 'cool' } };

const STAGE_COLOR = { new: '#22d3ee', scoped: '#a78bfa', engaged: '#10b981' };
const TOUCH_KINDS = ['email', 'dm', 'call', 'meeting', 'note', 'follow_up'];
const IMPORT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_IMPORT = 300;

// Minimal RFC-4180-ish CSV parser (handles quoted fields + escaped "" + CRLF).
function parseCsv(text) {
  const rows = []; let field = '', row = [], inQ = false, i = 0;
  const pushF = () => { row.push(field); field = ''; };
  const pushR = () => { pushF(); rows.push(row); row = []; };
  while (i < text.length) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } inQ = false; i++; continue; }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQ = true; i++; continue; }
    if (ch === ',') { pushF(); i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { pushR(); i++; continue; }
    field += ch; i++;
  }
  if (field.length || row.length) pushR();
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

// Turn CSV text into {email,name,company,segment} rows via header-aliased columns.
// Requires an 'email' column; other fields are optional. Returns {leads, skipped, error}.
function csvToLeads(text) {
  const rows = parseCsv(String(text || ''));
  if (!rows.length) return { leads: [], skipped: 0, error: 'empty' };
  const header = rows[0].map((c) => String(c).trim().toLowerCase());
  const find = (aliases) => header.findIndex((hh) => aliases.includes(hh));
  const iEmail = find(['email', 'e-mail', 'email address', 'emailaddress']);
  if (iEmail === -1) return { leads: [], skipped: 0, error: 'no_email_col' };
  const iName = find(['name', 'first name', 'firstname', 'contact', 'contact name', 'owner']);
  const iCompany = find(['company', 'business', 'business name', 'businessname', 'company name']);
  const iSegment = find(['segment', 'niche', 'category', 'industry', 'type']);
  const cell = (arr, idx) => (idx > -1 ? String(arr[idx] || '').trim() : '');
  const leads = []; let skipped = 0;
  for (let r = 1; r < rows.length; r++) {
    const email = cell(rows[r], iEmail).toLowerCase();
    if (!IMPORT_EMAIL_RE.test(email)) { skipped++; continue; }
    leads.push({ email, name: cell(rows[r], iName), company: cell(rows[r], iCompany), segment: cell(rows[r], iSegment) });
  }
  return { leads, skipped };
}

function opener(lead) {
  const first = String(lead.name || '').trim().split(/\s+/)[0] || 'there';
  const co = lead.company ? lead.company : 'your shop';
  const who = lead.segment ? lead.segment : 'service';
  return `Hi ${first} — I set up an AI front desk for ${who} businesses: it texts back every missed call, answers 24/7, and replies to web leads in seconds — so the jobs that hit voicemail stop going to the next guy on the list. I build it and, because I'm a QA engineer, I actually test it before it talks to your customers. Worth a quick look at what it'd catch for ${co}? — Jason`;
}

export function renderMarketing(mount, key, deps) {
  const { h, clear, authHeaders, renderNotAuthorized } = deps;

  async function api(method, path, body) {
    const opts = { method, headers: authHeaders(body ? { 'Content-Type': 'application/json' } : {}) };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    if (res.status === 401) return { unauthorized: true };
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  }

  // Bulk-import panel: paste/upload a scored shortlist CSV → deduped into the pipeline.
  function importPanel() {
    const details = h('details', { class: 'admin-card', style: 'margin-bottom:16px' });
    details.appendChild(h('summary', { style: 'cursor:pointer;font-size:13px;color:#e5e5ea' }, 'Import leads from CSV'));
    details.appendChild(h('p', { class: 'subtle', style: 'font-size:12px;margin:10px 0' },
      'Paste your scored shortlist or choose a .csv file. Needs an "email" column; name / company / segment are used if present. Re-importing is safe — leads are matched by email, never duplicated.'));
    const ta = h('textarea', { rows: '6', placeholder: 'email,name,company,segment\njane@acme.co,Jane Doe,Acme HVAC,hvac', style: 'width:100%;box-sizing:border-box;background:#0d0d11;border:1px solid #23232b;border-radius:8px;color:#e5e5ea;font-family:var(--mono,monospace);font-size:12px;padding:10px' });
    const file = h('input', { type: 'file', accept: '.csv,text/csv', style: 'font-size:12px;color:#8E8882;max-width:220px' });
    const previewBtn = h('button', { type: 'button', class: 'btn-ghost', style: 'padding:7px 14px;font-size:12px' }, 'Preview');
    const importBtn = h('button', { type: 'button', class: 'btn-solid green', style: 'padding:7px 14px;font-size:12px', disabled: 'disabled' }, 'Import');
    const status = h('span', { class: 'subtle', style: 'font-size:12px' }, '');
    let parsed = [];
    const say = (msg) => { clear(status); status.appendChild(document.createTextNode(msg)); };
    function preview() {
      const { leads, skipped, error } = csvToLeads(ta.value || '');
      parsed = leads;
      if (error === 'no_email_col') { importBtn.disabled = true; say('CSV needs an "email" column header.'); return; }
      if (!leads.length) { importBtn.disabled = true; say('No valid rows with an email found.'); return; }
      const n = Math.min(leads.length, MAX_IMPORT);
      importBtn.disabled = false; importBtn.textContent = `Import ${n}`;
      say(`${n} lead${n === 1 ? '' : 's'} ready${skipped ? ` · ${skipped} skipped (no email)` : ''}${leads.length > MAX_IMPORT ? ` · capped at ${MAX_IMPORT}` : ''}`);
    }
    file.addEventListener('change', () => {
      const f = file.files && file.files[0]; if (!f) return;
      const reader = new window.FileReader();
      reader.onload = () => { ta.value = String(reader.result || ''); preview(); };
      reader.readAsText(f);
    });
    ta.addEventListener('input', () => { importBtn.disabled = true; importBtn.textContent = 'Import'; });
    previewBtn.addEventListener('click', preview);
    importBtn.addEventListener('click', async () => {
      if (!parsed.length) return;
      importBtn.disabled = true; say('Importing…');
      const r = await api('POST', '/api/prospects', { action: 'bulk_import', rows: parsed.slice(0, MAX_IMPORT) });
      if (r.unauthorized) { renderNotAuthorized(mount.parentNode || mount); return; }
      if (r.json && r.json.ok) {
        say(`Imported ✓ ${r.json.created || 0} new, ${r.json.updated || 0} updated${r.json.invalid ? `, ${r.json.invalid} invalid` : ''}`);
        ta.value = ''; parsed = []; importBtn.textContent = 'Import';
        setTimeout(draw, 1000); // refresh the board so the new leads appear
      } else { importBtn.disabled = false; say('Import failed — check the CSV and retry.'); }
    });
    details.appendChild(ta);
    details.appendChild(h('div', { style: 'display:flex;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap' }, file, previewBtn, importBtn, status));
    return details;
  }

  function draw() {
    clear(mount);
    mount.appendChild(importPanel());
    const statMount = h('div', { class: 'stat-row' });
    const nurtureMount = h('div', {});
    const listMount = h('div', { style: 'margin-top:18px' });
    mount.appendChild(statMount);
    mount.appendChild(nurtureMount);
    mount.appendChild(listMount);
    const stat = (n, l, color) => h('div', { class: 'stat' }, h('div', { class: 'n', style: color ? `color:${color}` : '' }, n), h('div', { class: 'l' }, l));

    api('GET', '/api/marketing').then((r) => {
      if (r.unauthorized) { renderNotAuthorized(mount.parentNode || mount); return; }
      if (r.status === 502 || !r.json || !r.json.ok) {
        statMount.appendChild(h('p', { class: 'subtle', style: 'color:#F59E0B' }, "Couldn't load outreach — refresh to retry."));
        return;
      }
      const { leads = [], needsActionCount = 0, nurture = {}, counts = {} } = r.json;
      const openCount = (counts.new || 0) + (counts.scoped || 0) + (counts.engaged || 0);
      clear(statMount);
      statMount.appendChild(stat(String(needsActionCount), 'Need a touch', '#F59E0B'));
      statMount.appendChild(stat(String(openCount), 'Open leads', '#22d3ee'));
      statMount.appendChild(stat(String(counts.won || 0), 'Won'));
      statMount.appendChild(stat(String(nurture.recentSends7d || 0), 'Nurture sent · 7d', '#10b981'));

      clear(nurtureMount);
      const nurtOn = nurture.enabled;
      nurtureMount.appendChild(h('div', { style: `margin-top:6px;font-family:var(--mono,monospace);font-size:11.5px;color:${nurtOn ? 'var(--faint)' : '#F59E0B'}` },
        nurtOn ? 'Automated nurture drip: ON (warm leads / unpaid proposals / expiring quotes).'
          : 'Automated nurture drip: OFF — set NURTURE_ENABLED=true to auto-send warm follow-ups.'));

      clear(listMount);
      listMount.appendChild(h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#10b981' }, 'hottest to close — chase these first'), h('span', { class: 'line' })));
      if (!leads.length) { listMount.appendChild(h('p', { class: 'subtle' }, 'No open leads yet — they appear here as prospects come in and go stale.')); return; }
      // ranked by close-intent (engagement + recency), hottest first
      const ordered = rankLeads(leads);
      for (const lead of ordered) listMount.appendChild(leadRow(lead));
    });

    function leadRow(lead) {
      const color = STAGE_COLOR[lead.stage] || '#8E8882';
      const stale = lead.needsAction;
      const wrap = h('div', { class: 'admin-card', style: `margin-bottom:10px;border-left:3px solid ${stale ? '#F59E0B' : 'transparent'}` });
      const sc = lead._score || { score: 0, tier: 'cool' };
      const tinfo = TIER[sc.tier] || TIER.cool;
      const head = h('div', { style: 'display:flex;align-items:center;gap:14px;flex-wrap:wrap' },
        h('span', { title: 'close-intent score (engagement + recency)', style: `font-family:var(--mono,monospace);font-size:10px;font-weight:700;letter-spacing:.05em;padding:3px 8px;border-radius:5px;color:${tinfo.c};border:1px solid ${tinfo.c}55;background:${tinfo.c}12` }, `${tinfo.t} ${sc.score}`),
        h('div', { style: 'flex:1;min-width:160px' },
          h('div', { style: 'font-size:14px' }, lead.name || lead.email || 'Unknown'),
          h('div', { class: 'mono', style: 'font-size:11px;color:var(--faint)' }, `${lead.company ? lead.company + ' · ' : ''}${lead.email || ''}`)),
        h('span', { style: `font-family:var(--mono,monospace);font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:${color}` }, lead.stage),
        h('span', { class: 'mono', style: `font-size:11px;color:${stale ? '#F59E0B' : 'var(--faint)'}` }, `${lead.daysSinceActivity}d · ${lead.suggestedAction}`));
      wrap.appendChild(head);

      // actions: log a touch + copy opener
      const kindSel = h('select', { style: 'background:#0d0d11;border:1px solid #23232b;border-radius:6px;padding:6px 8px;color:#e5e5ea;font-size:12px' },
        ...TOUCH_KINDS.map((k) => h('option', { value: k }, k.replace('_', ' '))));
      const logBtn = h('button', { type: 'button', class: 'btn-ghost', style: 'padding:6px 12px;font-size:12px' }, 'Log touch');
      const status = h('span', { class: 'subtle', style: 'font-size:11px' }, '');
      logBtn.addEventListener('click', async () => {
        logBtn.disabled = true; clear(status); status.appendChild(document.createTextNode('Logging…'));
        const r = await api('POST', '/api/prospects', { action: 'touch', id: lead.id, kind: kindSel.value });
        if (r.json && r.json.ok) { draw(); } else { logBtn.disabled = false; clear(status); status.appendChild(document.createTextNode('Failed — retry')); }
      });
      const copyBtn = h('button', { type: 'button', class: 'btn-ghost', style: 'padding:6px 12px;font-size:12px' }, 'Copy opener');
      copyBtn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(opener(lead)); clear(status); status.appendChild(document.createTextNode('Opener copied ✓')); }
        catch { clear(status); status.appendChild(document.createTextNode('Copy failed')); }
      });
      wrap.appendChild(h('div', { style: 'display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap' }, kindSel, logBtn, copyBtn, status));
      return wrap;
    }
  }

  draw();
}
