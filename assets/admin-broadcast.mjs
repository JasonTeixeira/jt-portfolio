// Broadcast (cockpit) — compose and send a newsletter to field-notes subscribers.
// Reuses /api/broadcast: GET for the live subscriber count, POST {test:true} to send a
// preview to yourself, POST to send to the whole list. Suppression + unsubscribe are
// handled server-side, so this UI only composes and confirms.

export function renderBroadcast(root, key, deps) {
  const { h, clear, authHeaders, renderNotAuthorized } = deps;
  clear(root);
  const wrap = h('div', {});
  wrap.appendChild(h('div', { class: 'sec-rule' }, h('span', { class: 'sec-label', style: 'color:#10b981' }, 'cockpit · broadcast'), h('span', { class: 'line' })));
  wrap.appendChild(h('h1', { class: 'sec-title' }, 'Broadcast'));
  wrap.appendChild(h('p', { class: 'subtle', style: 'font-size:13px;margin-top:4px;max-width:640px' }, 'Send a note to your field-notes subscribers. Anyone who unsubscribed or bounced is skipped automatically, and every send is deduped. Always send a test to yourself first.'));

  const countLine = h('p', { class: 'subtle', style: 'font-size:13px;margin-top:10px' }, 'Loading subscriber count…');
  wrap.appendChild(countLine);

  const inputStyle = 'width:100%;background:#0E0E11;border:1px solid #26262c;border-radius:8px;color:#F4F2EF;padding:10px 12px;font-size:14px;font-family:inherit;margin-top:6px';
  const label = (t) => h('div', { style: 'font-family:var(--mono,monospace);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#8E8882;margin-top:16px' }, t);

  const subject = h('input', { type: 'text', maxlength: '160', placeholder: 'Subject line', style: inputStyle });
  const heading = h('input', { type: 'text', maxlength: '160', placeholder: 'Headline inside the email (defaults to the subject)', style: inputStyle });
  const bodyText = h('textarea', { rows: '10', maxlength: '20000', placeholder: 'Write your update. Blank lines start new paragraphs. Plain text only — no HTML needed.', style: inputStyle + ';resize:vertical;line-height:1.5' });
  const ctaLabel = h('input', { type: 'text', maxlength: '40', placeholder: 'Button label (optional), e.g. Read the guide', style: inputStyle });
  const ctaUrl = h('input', { type: 'url', placeholder: 'Button link (optional), https://…', style: inputStyle });

  const status = h('div', { style: 'margin-top:14px;font-size:13px;min-height:18px' });
  const testBtn = h('button', { type: 'button', class: 'btn-ghost', style: 'padding:9px 16px;font-size:13px;border:1px solid #26262c;border-radius:8px;color:#F4F2EF;background:transparent;cursor:pointer' }, 'Send test to me');
  const sendBtn = h('button', { type: 'button', style: 'padding:9px 18px;font-size:13px;font-weight:700;border:none;border-radius:8px;color:#052e22;background:#10b981;cursor:pointer' }, 'Send to subscribers →');
  const btnRow = h('div', { style: 'display:flex;gap:10px;align-items:center;margin-top:20px;flex-wrap:wrap' }, testBtn, sendBtn);

  const form = h('div', { class: 'admin-card', style: 'margin-top:16px;padding:18px' },
    label('Subject'), subject, label('Headline'), heading, label('Body'), bodyText,
    label('Call to action (optional)'), ctaLabel, ctaUrl, btnRow, status);
  wrap.appendChild(form);
  root.appendChild(wrap);

  let subscriberCount = 0;
  const payload = () => ({
    subject: subject.value.trim(), heading: heading.value.trim(), bodyText: bodyText.value.trim(),
    ctaLabel: ctaLabel.value.trim(), ctaUrl: ctaUrl.value.trim(),
  });
  const setStatus = (msg, color) => { clear(status); status.appendChild(h('span', { style: `color:${color || '#A8A29E'}` }, msg)); };
  const valid = () => payload().subject && payload().bodyText;

  fetch('/api/broadcast', { headers: authHeaders() }).then(async (res) => {
    if (res.status === 401) { renderNotAuthorized(root); return; }
    const j = await res.json().catch(() => null);
    subscriberCount = (j && j.subscribers) || 0;
    clear(countLine);
    countLine.appendChild(h('span', {}, `${subscriberCount} active subscriber${subscriberCount === 1 ? '' : 's'} on the list.`));
    sendBtn.textContent = `Send to ${subscriberCount} subscriber${subscriberCount === 1 ? '' : 's'} →`;
  }).catch(() => { clear(countLine); countLine.appendChild(h('span', { style: 'color:#F59E0B' }, "Couldn't load subscriber count.")); });

  async function post(extra) {
    const res = await fetch('/api/broadcast', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ ...payload(), ...extra }) });
    return { status: res.status, json: await res.json().catch(() => null) };
  }

  testBtn.addEventListener('click', async () => {
    if (!valid()) { setStatus('Add a subject and some body text first.', '#F59E0B'); return; }
    setStatus('Sending test…'); testBtn.disabled = true;
    const { json } = await post({ test: true });
    testBtn.disabled = false;
    setStatus(json && json.ok ? `Test sent to ${json.to}. Check your inbox.` : 'Test failed to send.', json && json.ok ? '#10b981' : '#F59E0B');
  });

  sendBtn.addEventListener('click', async () => {
    if (!valid()) { setStatus('Add a subject and some body text first.', '#F59E0B'); return; }
    if (!window.confirm(`Send this to ${subscriberCount} subscriber${subscriberCount === 1 ? '' : 's'}? This cannot be undone.`)) return;
    setStatus('Sending…'); sendBtn.disabled = true; testBtn.disabled = true;
    const { json } = await post({});
    sendBtn.disabled = false; testBtn.disabled = false;
    if (json && json.ok) {
      setStatus(`Sent ${json.sent}, skipped ${json.skipped}${json.failed ? `, failed ${json.failed}` : ''}.${json.capped ? ` ${json.remaining} left — click send again to continue this same broadcast (already-sent addresses are skipped).` : ' Done.'}`, '#10b981');
    } else {
      setStatus('Send failed. Check that email is configured, then retry.', '#F59E0B');
    }
  });
}
