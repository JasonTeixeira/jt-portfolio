// Scope Studio page controller — offline question flow + plan-key derivation.
// Renders questions, tracks answers, and rehydrates from a shared URL.
// The actual plan visualization is installed by Task 6 via window.__renderScopePlan.

window.__renderScopePlan = window.__renderScopePlan || function () {};

import { QUESTIONS, keysFromAnswers, computePlan, encodeKeys, decodeKeys, DISCLAIMER } from './scope-core.mjs';

const root = document.getElementById('scope-root');
const qMount = document.getElementById('scope-questions');
const planMount = document.getElementById('scope-plan');
const disc = document.getElementById('scope-disclaimer');

if (root && qMount && planMount && disc) {
  disc.textContent = DISCLAIMER;
  const answers = {};
  renderQuestions();
  rehydrateFromUrl();
  renderPlan();

  function renderQuestions() {
    qMount.innerHTML = QUESTIONS.map((q) => `
      <fieldset style="border:1px solid #2A2826;border-radius:12px;padding:18px 20px;margin:0 0 16px">
        <legend style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#8E8882;padding:0 6px">${q.prompt}</legend>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
          ${q.options.map((o) => `<button type="button" class="scope-opt" data-q="${q.id}" data-id="${o.id}" data-multi="${q.multi}" aria-pressed="false" style="font-family:'JetBrains Mono',monospace;font-size:12.5px;color:#A8A29E;border:1px solid #2A2826;border-radius:999px;padding:7px 13px;background:transparent;cursor:pointer">${o.label}</button>`).join('')}
        </div>
      </fieldset>`).join('');
    qMount.querySelectorAll('.scope-opt').forEach((btn) => btn.addEventListener('click', onPick));
  }

  function onPick(e) {
    const b = e.currentTarget;
    const q = b.dataset.q;
    const id = b.dataset.id;
    const multi = b.dataset.multi === 'true';
    answers[q] = answers[q] || [];
    if (multi) {
      const i = answers[q].indexOf(id);
      if (i >= 0) answers[q].splice(i, 1);
      else answers[q].push(id);
    } else {
      answers[q] = answers[q][0] === id ? [] : [id];
      qMount.querySelectorAll(`.scope-opt[data-q="${q}"]`).forEach((x) => setPressed(x, false));
    }
    setPressed(b, answers[q].includes(id));
    renderPlan();
  }

  function setPressed(btn, on) {
    btn.setAttribute('aria-pressed', String(on));
    btn.style.color = on ? '#09090B' : '#A8A29E';
    btn.style.background = on ? '#22d3ee' : 'transparent';
    btn.style.borderColor = on ? '#22d3ee' : '#2A2826';
  }

  function segmentFromAnswers() {
    const s = (answers.segment || [])[0];
    return { 'seg-service': 'service-business', 'seg-aiproduct': 'ai-product', 'seg-ops': 'ops-automation', 'seg-product': 'product-build' }[s] || null;
  }

  function renderPlan() {
    const keys = keysFromAnswers(answers);
    const plan = computePlan(keys, segmentFromAnswers());
    window.__renderScopePlan(plan);
    syncUrl();
    root.setAttribute('data-state', keys.length ? 'plan' : 'discovery');
  }

  function selectedOptionIds() {
    const ids = [];
    QUESTIONS.forEach((q) => (answers[q.id] || []).forEach((id) => ids.push(id)));
    return ids;
  }

  function syncUrl() {
    const ids = selectedOptionIds();
    const enc = ids.length ? '#plan=' + encodeKeys(ids) : location.pathname;
    history.replaceState(null, '', enc);
  }

  function rehydrateFromUrl() {
    const m = location.hash.match(/plan=([^&]+)/);
    if (!m) return;
    const { keys: ids } = decodeKeys(m[1]); // these are option ids
    const idSet = new Set(ids);
    QUESTIONS.forEach((q) => q.options.forEach((o) => {
      if (idSet.has(o.id)) {
        answers[q.id] = answers[q.id] || [];
        if (!answers[q.id].includes(o.id)) answers[q.id].push(o.id);
        const btn = qMount.querySelector(`.scope-opt[data-q="${q.id}"][data-id="${o.id}"]`);
        if (btn) setPressed(btn, true);
      }
    }));
  }
}
