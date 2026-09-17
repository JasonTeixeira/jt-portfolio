// Scope Studio page controller — offline question flow + a live system blueprint.
// As you pick needs, a real architecture diagram assembles (nodes per capability,
// grouped by phase, colored by track) and resolves to a "proven" verdict when an
// eval gate is present. Everything is deterministic; numbers come only from the rate card.
// Defines window.__renderScopePlan (blueprint + HUD + itemized plan) directly.

import { QUESTIONS, keysFromAnswers, computePlan, encodeKeys, decodeKeys, DISCLAIMER, CARD_BY_KEY } from './scope-core.mjs';

const TRACK_COLOR = { 'AI Build': '#22d3ee', 'Eval & QA': '#a78bfa', 'Test Automation': '#10b981', 'Automation': '#F59E0B', 'Product': '#8FA0FF' };
const PHASE_COLOR = { audit: '#8FA0FF', build: '#22d3ee', gate: '#a78bfa', operate: '#10b981' };
const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function money(n) { return '$' + (n >= 1000 ? Math.round(n / 100) / 10 + 'k' : String(Math.round(n))); }
function band([lo, hi]) { return money(lo) + '–' + money(hi); }
function trackColor(t) { return TRACK_COLOR[t] || '#8E8882'; }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ── UI chrome localization ────────────────────────────────────────────────
   Only the CHROME rendered by this controller is localized (nav, progress,
   review panel, HUD labels, lead statuses, proposal, share summary). The
   QUESTION CONTENT — segment/capability names + why-text from scope-core.mjs
   (QUESTIONS / RATE_CARD) — is English across all locales today; translating
   that is a separate, larger content job and is intentionally left untouched.
   Keyed off <html lang>, falling back to English for any unknown locale. */
const LANG = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
const STRINGS = {
  en: {
    back: 'Back', next: 'Continue', see: 'See my plan', edit: 'Edit answers',
    pick: 'Pick all that apply', q: 'Question', of: 'of', done: 'Done',
    planReady: 'Your plan&rsquo;s ready.', oneMore: 'One more thing.',
    doneHas: 'Your itemized plan and indicative range are assembled &mdash; on the right on desktop, just below on mobile. Adjust anytime.',
    doneEmpty: 'You haven&rsquo;t picked anything to build yet. Choose what you want to happen and your plan assembles instantly.',
    emailPlan: 'Email me the plan', pickBuild: 'Pick what to build',
    startHere: 'Start here',
    auditNote: 'Fixed-price audit week &mdash; a written plan &amp; firm quote, <b>credited into the build</b>.',
    fullBuild: 'full build &middot; indicative', typical: 'typical', timeline: 'timeline', wks: 'wks',
    totalLblA: 'full build &middot; indicative range &middot; typical ~', totalLblB: ' &middot; exact scope on a call',
    totalAudit: 'Or start with the <b>$497 audit week</b> &mdash; credited into the build, so the real cost of starting is $0.',
    bpEmpty: 'Your system builds here.<br><span>Pick what you want to happen — watch it assemble, priced and proven.</span>',
    bpYourBuild: 'YOUR BUILD', bpProven: 'PROVEN', bpShipped: 'SHIPPED',
    bpAriaA: 'A live diagram of your scoped system: ', bpAriaMid: ' components across ', bpAriaEnd: ' phases, ',
    bpGateOn: 'with an evaluation gate that proves it works', bpGateOff: 'ready to ship',
    summHead: "Here's the plan I scoped on your site:", summTotal: 'Indicative total:', summWeeks: 'weeks',
    summNote: '(Indicative only. Happy to lock exact scope on a call.)', summShared: 'Shared plan:',
    sending: 'Sending…',
    statusEmailed: 'Done — your itemized plan is on its way to your inbox, with a link to book a 15-minute call. I review every one myself.',
    statusCaptured: "Got it — I've got your plan and I'll follow up personally, usually within a day. I review every one myself.",
    statusNoPlan: "Got it — I'll reach out personally to scope this with you, usually within a day.",
    statusFail: 'Couldn’t send from here. Use “open in your email app” below, or email hello@sageideas.dev.',
    writingProposal: 'Writing your proposal…', yourProposal: 'Your proposal',
    readItToMe: 'Read it to me', stopReading: 'Stop reading',
    acceptWriting: 'Accept &amp; get it in writing &rarr;', bookCall: 'Book a 15-min call',
    copied: 'Copied', copyLink: 'Copy shareable link',
  },
  es: {
    back: 'Atrás', next: 'Continuar', see: 'Ver mi plan', edit: 'Editar respuestas',
    pick: 'Elige todas las que apliquen', q: 'Pregunta', of: 'de', done: 'Listo',
    planReady: 'Tu plan está listo.', oneMore: 'Una cosa más.',
    doneHas: 'Tu plan detallado y rango indicativo están armados &mdash; a la derecha en escritorio, justo debajo en móvil. Ajústalo cuando quieras.',
    doneEmpty: 'Aún no has elegido nada para construir. Elige lo que quieres que suceda y tu plan se arma al instante.',
    emailPlan: 'Envíame el plan', pickBuild: 'Elige qué construir',
    startHere: 'Empieza aquí',
    auditNote: 'Semana de auditoría a precio fijo &mdash; un plan escrito y presupuesto firme, <b>abonado a la construcción</b>.',
    fullBuild: 'construcción completa &middot; indicativo', typical: 'típico', timeline: 'plazo', wks: 'sem',
    totalLblA: 'construcción completa &middot; rango indicativo &middot; típico ~', totalLblB: ' &middot; alcance exacto en una llamada',
    totalAudit: 'O empieza con la <b>semana de auditoría de $497</b> &mdash; abonada a la construcción, así el costo real de empezar es $0.',
    bpEmpty: 'Tu sistema se construye aquí.<br><span>Elige lo que quieres que suceda — míralo ensamblarse, con precio y comprobado.</span>',
    bpYourBuild: 'TU SISTEMA', bpProven: 'COMPROBADO', bpShipped: 'ENTREGADO',
    bpAriaA: 'Un diagrama en vivo de tu sistema delimitado: ', bpAriaMid: ' componentes en ', bpAriaEnd: ' fases, ',
    bpGateOn: 'con una prueba de evaluación que demuestra que funciona', bpGateOff: 'listo para lanzar',
    summHead: 'Este es el plan que delimité en tu sitio:', summTotal: 'Total indicativo:', summWeeks: 'semanas',
    summNote: '(Solo indicativo. Con gusto fijamos el alcance exacto en una llamada.)', summShared: 'Plan compartido:',
    sending: 'Enviando…',
    statusEmailed: 'Listo — tu plan detallado va camino a tu bandeja de entrada, con un enlace para reservar una llamada de 15 minutos. Reviso cada uno personalmente.',
    statusCaptured: 'Entendido — tengo tu plan y te contactaré personalmente, normalmente en un día. Reviso cada uno personalmente.',
    statusNoPlan: 'Entendido — me pondré en contacto personalmente para delimitar esto contigo, normalmente en un día.',
    statusFail: 'No se pudo enviar desde aquí. Usa «abrir en tu app de correo» abajo, o escribe a hello@sageideas.dev.',
    writingProposal: 'Escribiendo tu propuesta…', yourProposal: 'Tu propuesta',
    readItToMe: 'Léemelo', stopReading: 'Detener lectura',
    acceptWriting: 'Aceptar y recibirlo por escrito &rarr;', bookCall: 'Reserva una llamada de 15 min',
    copied: 'Copiado', copyLink: 'Copiar enlace para compartir',
  },
  pt: {
    back: 'Voltar', next: 'Continuar', see: 'Ver meu plano', edit: 'Editar respostas',
    pick: 'Selecione todas as que se aplicam', q: 'Pergunta', of: 'de', done: 'Concluído',
    planReady: 'Seu plano está pronto.', oneMore: 'Só mais uma coisa.',
    doneHas: 'Seu plano detalhado e faixa indicativa estão prontos &mdash; à direita no desktop, logo abaixo no celular. Ajuste quando quiser.',
    doneEmpty: 'Você ainda não escolheu nada para construir. Escolha o que você quer que aconteça e seu plano se monta na hora.',
    emailPlan: 'Envie-me o plano', pickBuild: 'Escolha o que construir',
    startHere: 'Comece aqui',
    auditNote: 'Semana de auditoria com preço fixo &mdash; um plano escrito e orçamento firme, <b>creditado na construção</b>.',
    fullBuild: 'construção completa &middot; indicativo', typical: 'típico', timeline: 'prazo', wks: 'sem',
    totalLblA: 'construção completa &middot; faixa indicativa &middot; típico ~', totalLblB: ' &middot; escopo exato em uma ligação',
    totalAudit: 'Ou comece com a <b>semana de auditoria de $497</b> &mdash; creditada na construção, então o custo real de começar é $0.',
    bpEmpty: 'Seu sistema é construído aqui.<br><span>Escolha o que você quer que aconteça — veja montar, precificado e comprovado.</span>',
    bpYourBuild: 'SEU SISTEMA', bpProven: 'COMPROVADO', bpShipped: 'ENTREGUE',
    bpAriaA: 'Um diagrama ao vivo do seu sistema escopado: ', bpAriaMid: ' componentes em ', bpAriaEnd: ' fases, ',
    bpGateOn: 'com um portão de avaliação que prova que funciona', bpGateOff: 'pronto para lançar',
    summHead: 'Este é o plano que escopei no seu site:', summTotal: 'Total indicativo:', summWeeks: 'semanas',
    summNote: '(Apenas indicativo. Fico feliz em fechar o escopo exato em uma ligação.)', summShared: 'Plano compartilhado:',
    sending: 'Enviando…',
    statusEmailed: 'Pronto — seu plano detalhado está a caminho da sua caixa de entrada, com um link para agendar uma ligação de 15 minutos. Eu reviso cada um pessoalmente.',
    statusCaptured: 'Entendi — tenho seu plano e vou responder pessoalmente, geralmente em um dia. Eu reviso cada um pessoalmente.',
    statusNoPlan: 'Entendi — vou entrar em contato pessoalmente para escopar isso com você, geralmente em um dia.',
    statusFail: 'Não foi possível enviar daqui. Use «abrir no seu app de e-mail» abaixo, ou escreva para hello@sageideas.dev.',
    writingProposal: 'Escrevendo sua proposta…', yourProposal: 'Sua proposta',
    readItToMe: 'Leia para mim', stopReading: 'Parar leitura',
    acceptWriting: 'Aceitar e receber por escrito &rarr;', bookCall: 'Agende uma ligação de 15 min',
    copied: 'Copiado', copyLink: 'Copiar link para compartilhar',
  },
};
const L = STRINGS[LANG] || STRINGS.en;

/* ── anonymous prospect tracking: fire-and-forget, never affects the UI ──
   A missing/failing /api/scope endpoint (static hosting, no env configured)
   must never log a console error or block any interaction. */
// Always emit a valid UUID v4 — the server stores prospectId in a Postgres `uuid`
// column, so a non-UUID string (the old Date+Math.random fallback) silently failed
// the cast and dropped the write. crypto.randomUUID needs a secure context; this
// getRandomValues path also covers http/older browsers so telemetry is never lost.
function uuid4() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  const b = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0'));
  return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
}
function prospectId() {
  try {
    let pid = localStorage.getItem('scope_pid');
    if (!pid) {
      pid = uuid4();
      localStorage.setItem('scope_pid', pid);
    }
    return pid;
  } catch {
    return null; // localStorage unavailable (private mode, quota) — tracking is best-effort only
  }
}

function track(type, extra) {
  // Mirror every funnel step into GA4 (ga.js relays window.va('event',{name,data})) so
  // start → question → plan → lead drop-off is measurable, not just written to Supabase.
  try { if (typeof window !== 'undefined' && typeof window.va === 'function') window.va('event', { name: 'scope_' + type, data: extra || {} }); } catch { /* analytics must never break the tool */ }
  try {
    const pid = prospectId();
    if (!pid) return;
    fetch('/api/scope', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prospectId: pid, type, ...extra }),
    }).catch(() => {}); // network failure — swallow, never surface to the UI
  } catch {
    // fetch/JSON unavailable or threw synchronously — tracking must never break the tool
  }
}

/* ── the signature: a live-assembling system blueprint ── */
function buildBlueprint(plan) {
  const W = 480;
  const hasGate = plan.phases.some((p) => p.phase === 'gate');
  const cols = plan.phases; // ordered audit→build→gate→operate
  const perSide = Math.ceil(Math.max(...cols.map((c) => c.items.length), 1) / 2);
  const H = Math.max(220, 150 + perSide * 34);
  const midY = H / 2;
  const x0 = 46, x1 = W - 46;
  const colX = cols.length === 1 ? [(x0 + x1) / 2] : cols.map((_, i) => x0 + 92 + (i * (x1 - x0 - 184)) / Math.max(cols.length - 1, 1));

  const NS = 'http://www.w3.org/2000/svg';
  const parts = [];
  // rail
  parts.push(`<line x1="${x0}" y1="${midY}" x2="${x1}" y2="${midY}" stroke="#2A2826" stroke-width="1.5" stroke-linecap="round"/>`);
  // capability nodes branch off phase stations
  let delay = 0;
  cols.forEach((col, ci) => {
    const sx = colX[ci];
    parts.push(`<circle cx="${sx}" cy="${midY}" r="3" fill="${PHASE_COLOR[col.phase]}" class="bp-station"/>`);
    parts.push(`<text x="${sx}" y="${midY + 24}" text-anchor="middle" class="bp-phase" fill="${PHASE_COLOR[col.phase]}">${esc(col.label).toUpperCase()}</text>`);
    col.items.forEach((it, k) => {
      const up = k % 2 === 0;
      const tier = Math.floor(k / 2);
      const ny = midY + (up ? -1 : 1) * (46 + tier * 34);
      const c = trackColor(it.track);
      const d = (delay += 55);
      parts.push(`<line x1="${sx}" y1="${midY}" x2="${sx}" y2="${ny}" stroke="${c}" stroke-opacity="0.4" stroke-width="1.25" class="bp-edge" style="--d:${d}ms"/>`);
      parts.push(`<g class="bp-node" style="--d:${d}ms">
        <circle cx="${sx}" cy="${ny}" r="11" fill="none" stroke="${c}" stroke-opacity="0.28" class="bp-halo"/>
        <circle cx="${sx}" cy="${ny}" r="5" fill="${c}"/>
        <text x="${sx}" y="${ny + (up ? -16 : 22)}" text-anchor="middle" class="bp-label" fill="#C4BFB8">${esc(it.name)}</text>
      </g>`);
    });
  });
  // start + verdict
  parts.push(`<g class="bp-node" style="--d:0ms"><circle cx="${x0}" cy="${midY}" r="6" fill="#F4F2EF"/><text x="${x0}" y="${midY - 16}" text-anchor="middle" class="bp-cap" fill="#8E8882">${esc(L.bpYourBuild)}</text></g>`);
  const vc = hasGate ? '#10b981' : '#8E8882';
  const vlabel = hasGate ? L.bpProven : L.bpShipped;
  parts.push(`<g class="bp-node bp-verdict${hasGate ? ' on' : ''}" style="--d:${delay + 120}ms">
    <circle cx="${x1}" cy="${midY}" r="12" fill="none" stroke="${vc}" stroke-opacity="0.35" class="bp-halo"/>
    <circle cx="${x1}" cy="${midY}" r="6" fill="${vc}"/>
    <text x="${x1}" y="${midY - 18}" text-anchor="middle" class="bp-cap" fill="${vc}">${vlabel}</text>
  </g>`);
  const packet = REDUCED ? '' : `<circle r="3.5" fill="#22d3ee" class="bp-packet"><animate attributeName="cx" from="${x0}" to="${x1}" dur="3.2s" repeatCount="indefinite"/><animate attributeName="cy" values="${midY};${midY}" dur="3.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0" dur="3.2s" repeatCount="indefinite"/></circle>`;
  const aria = `${L.bpAriaA}${plan.count}${L.bpAriaMid}${cols.length}${L.bpAriaEnd}${hasGate ? L.bpGateOn : L.bpGateOff}.`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}" style="display:block;width:100%;height:auto;overflow:visible">${parts.join('')}${packet}</svg>`;
}

/* ── count-up on the total band ── */
let lastLo = 0, lastHi = 0, rafId = 0;
function animateTotal(el, toLo, toHi) {
  if (REDUCED) { el.textContent = band([toLo, toHi]); lastLo = toLo; lastHi = toHi; return; }
  cancelAnimationFrame(rafId);
  const fromLo = lastLo, fromHi = lastHi, t0 = performance.now(), dur = 520;
  function step(now) {
    const p = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = band([Math.round(fromLo + (toLo - fromLo) * e), Math.round(fromHi + (toHi - fromHi) * e)]);
    if (p < 1) rafId = requestAnimationFrame(step); else { lastLo = toLo; lastHi = toHi; }
  }
  rafId = requestAnimationFrame(step);
}

window.__renderScopePlan = function (plan) {
  const bp = document.getElementById('scope-blueprint');
  const hud = document.getElementById('scope-hud');
  const mount = document.getElementById('scope-plan');
  if (!mount) return;

  if (!plan.count) {
    if (bp) bp.innerHTML = `<div class="bp-empty"><span class="bp-seed"></span><p>${L.bpEmpty}</p></div>`;
    if (hud) hud.innerHTML = '';
    mount.innerHTML = '';
    lastLo = lastHi = 0;
    return;
  }

  if (bp) bp.innerHTML = buildBlueprint(plan);

  // Lead with the low-commitment rung: the fixed-price audit is the real entry
  // point (credited into the build), so people anchor on $497, not the ceiling.
  // The full range stays live-assembling, now with a "typical" midpoint so it
  // reads as one number with a spread, not two scary endpoints.
  const mid = Math.round((plan.totalBand[0] + plan.totalBand[1]) / 2);

  if (hud) {
    hud.innerHTML = `
      <div class="hud-audit">
        <span class="ha-badge">${L.startHere}</span>
        <span class="ha-price">$497</span>
        <span class="ha-note">${L.auditNote}</span>
      </div>
      <div class="hud-row">
        <div class="hud-stat"><span class="hud-num" data-track="green" id="scope-total-num">${band(plan.totalBand)}</span><span class="hud-lbl">${L.fullBuild}</span></div>
        <div class="hud-stat"><span class="hud-num sm">~${money(mid)}</span><span class="hud-lbl">${L.typical}</span></div>
        <div class="hud-stat"><span class="hud-num sm">~${plan.timelineWeeks[0]}–${plan.timelineWeeks[1]}<span class="hud-u">${L.wks}</span></span><span class="hud-lbl">${L.timeline}</span></div>
      </div>
      <div class="hud-bar" aria-hidden="true">${plan.phases.map((p) => `<span style="flex:${p.items.length};background:${PHASE_COLOR[p.phase]}"></span>`).join('')}</div>`;
    const num = document.getElementById('scope-total-num');
    if (num) animateTotal(num, plan.totalBand[0], plan.totalBand[1]);
  }

  const phaseCards = plan.phases.map((p) => `
    <div class="plan-phase">
      <div class="plan-phase-h" style="color:${PHASE_COLOR[p.phase]}"><span class="pp-dot" style="background:${PHASE_COLOR[p.phase]}"></span>${esc(p.label)} <span class="pp-band">${band(p.band)}</span></div>
      ${p.items.map((i) => `
        <div class="plan-item" style="--tc:${trackColor(i.track)}">
          <div class="pi-main"><div class="pi-name">${esc(i.name)}</div><div class="pi-why">${esc(i.why)}</div></div>
          <div class="pi-price">${band(i.band)}<span class="pi-eff">${esc(i.effort)}</span></div>
        </div>`).join('')}
    </div>`).join('');

  // #scope-total kept for the smoke test (contains "$" and "indicative")
  mount.innerHTML = `
    <div class="plan-card">
      ${phaseCards}
      <div id="scope-total" class="plan-total">
        <span class="pt-num">${band(plan.totalBand)}</span>
        <span class="pt-lbl">${L.totalLblA}${money(mid)}${L.totalLblB}</span>
        <span class="pt-audit">${L.totalAudit}</span>
      </div>
    </div>`;
};

/* ─────────────────────────── controller ─────────────────────────── */
const root = document.getElementById('scope-root');
const qMount = document.getElementById('scope-questions');
const planMount = document.getElementById('scope-plan');
const disc = document.getElementById('scope-disclaimer');

function optionColor(o) {
  const k = (o.keys || [])[0];
  const card = k && CARD_BY_KEY.get(k);
  return card ? trackColor(card.track) : '#22d3ee';
}

if (root && qMount && planMount && disc) {
  disc.textContent = DISCLAIMER;
  const answers = {};
  let planTrackTimer = 0;
  // A capability-key selection applied by the AI chat (assets/scope-chat.mjs),
  // taking priority over the questionnaire's answers until the visitor touches
  // a questionnaire option again (see onPick below) — both surfaces drive the
  // same computePlan → __renderScopePlan blueprint, whichever was touched last.
  let chatKeys = null;
  let chatSegment = null;
  let curKeys = [], curSegment = null, curPlan = null; // latest computed plan, for the AI proposal

  // ── one-question-at-a-time flow state ──
  // The questionnaire renders a single question per screen (Typeform-style) with a
  // progress stepper, Back/Continue nav, and a done panel. `step` indexes QUESTIONS;
  // `answers`, keysFromAnswers → computePlan → __renderScopePlan stay unchanged.
  const UI = { back: L.back, next: L.next, see: L.see, edit: L.edit, pick: L.pick, q: L.q, of: L.of, done: L.done };
  const ARROW_R = '<svg class="sf-ar" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const ARROW_L = '<svg class="sf-ar sf-ar-l" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';
  const CHECK = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
  let step = 0;
  let advTimer = 0;

  // entry chooser: the two cards reuse #scope-mode-quick / #scope-mode-chat so
  // scope-chat.mjs's setMode() wiring (hidden toggles + aria-pressed + openChat) still fires.
  const quickCard = document.getElementById('scope-mode-quick');
  const chatCard = document.getElementById('scope-mode-chat');
  const chatRootEl = document.getElementById('scope-chat');
  const entryEl = document.getElementById('scope-entry'); // the two-card chooser block
  root.dataset.entry = 'choose';

  // One-time voiced hand-off (Nadine) the first time a real plan assembles — a warm
  // "there's your plan" moment. Generic line (never TTS of the dynamic plan); honors the
  // concierge voice-off pref and only fires after the visitor's own interaction.
  // Declared BEFORE the init sequence below: renderPlan() runs during init and, on a
  // deep-linked (#plan=/#caps=) load, immediately calls playPlanReady() — if this state
  // were declared further down it would hit the temporal dead zone and throw, aborting
  // init before maybeAutoEnter() could route the visitor to the review.
  const SS_LOC = /^\/pt(\/|$)/.test(location.pathname) ? 'pt' : /^\/es(\/|$)/.test(location.pathname) ? 'es' : 'en';
  let planVoicePlayed = false;
  function playPlanReady() {
    if (planVoicePlayed) return;
    planVoicePlayed = true;
    try {
      if (localStorage.getItem('atlas-voice') === 'off') return;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      new window.Audio('/assets/concierge/' + SS_LOC + '/planReady.mp3?v=1').play().catch(() => {});
    } catch (e) { /* audio optional */ }
  }

  track('started');
  renderQuestions();
  rehydrateFromUrl();
  renderPlan();
  wireEntry();
  maybeAutoEnter();

  function wireEntry() {
    if (quickCard) quickCard.addEventListener('click', () => enterQuick(true));
    if (chatCard) chatCard.addEventListener('click', () => { root.dataset.entry = 'chat'; qMount.hidden = true; });
  }

  // Reveal the quick-questions flow. scope-chat.mjs also unhides #scope-questions on
  // this click; doing it here too keeps the chooser working if that module fails to load.
  function enterQuick(focusFirst) {
    root.dataset.entry = 'quick';
    qMount.hidden = false;
    if (chatRootEl) chatRootEl.hidden = true;
    if (quickCard) quickCard.setAttribute('aria-pressed', 'true');
    if (chatCard) chatCard.setAttribute('aria-pressed', 'false');
    if (focusFirst !== false) setTimeout(focusPrompt, REDUCED ? 0 : 60);
  }

  // step-0 Back returns to the chooser so the visitor can switch to Nadine.
  // Also un-hides the chooser for a deep-linked visitor who edited answers all
  // the way back to the start (maybeAutoEnter hides it on arrival).
  function exitToChooser() {
    clearTimeout(advTimer);
    if (entryEl) entryEl.hidden = false;
    root.dataset.entry = 'choose';
    qMount.hidden = true;
    if (chatRootEl) chatRootEl.hidden = true;
    if (quickCard) { quickCard.setAttribute('aria-pressed', 'false'); try { quickCard.focus(); } catch (e) { /* focus optional */ } }
    if (chatCard) chatCard.setAttribute('aria-pressed', 'false');
  }

  // A shared link (#plan= or #caps=) pre-fills answers/keys and decodes to ≥1
  // capability — land the visitor straight on the finished plan/review, NOT the
  // chooser. We enter quick mode (as if the quick card was picked), hide the
  // two-card chooser entirely so it isn't the primary view, and show the done
  // panel; renderPlan() already flipped data-state to "plan", which reveals the
  // gated #scope-handoff email capture. The "Edit answers" affordance in the
  // done panel (and step-0 Back → exitToChooser) restores full navigation.
  // A normal, no-hash load never reaches this branch, so the default chooser
  // flow is unchanged.
  function maybeAutoEnter() {
    const hasPlan = (chatKeys !== null && chatKeys.length) || QUESTIONS.some((q) => (answers[q.id] || []).length);
    if (!hasPlan) return;
    if (entryEl) entryEl.hidden = true;
    enterQuick(false);
    showReview();
  }

  // Hook for assets/scope-chat.mjs: apply an externally-derived (AI) capability
  // key selection to the SAME live blueprint/plan the questionnaire builds.
  window.__applyScopeKeys = function (keys, segment) {
    chatKeys = Array.isArray(keys) ? keys.filter(Boolean) : [];
    chatSegment = segment || null;
    renderPlan();
  };

  const leadForm = document.getElementById('scope-lead');
  if (leadForm) leadForm.addEventListener('submit', onLeadSubmit);

  const propBtn = document.getElementById('scope-proposal-btn');
  if (propBtn) propBtn.addEventListener('click', generateProposal);

  async function generateProposal() {
    if (!curPlan || !curPlan.count) return;
    const btn = document.getElementById('scope-proposal-btn');
    const body = document.getElementById('scope-proposal-body');
    if (!body) return;
    const orig = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = L.writingProposal; }
    track('proposal_written', { count: curPlan.count });
    let text = '';
    try {
      const r = await fetch('/api/proposal-narrative', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment: curSegment, items: curPlan.items.map((i) => i.name), totalBand: curPlan.totalBand, timelineWeeks: curPlan.timelineWeeks }),
      });
      const d = await r.json();
      text = (d && d.proposal) || '';
    } catch { text = ''; }
    if (btn) { btn.disabled = false; btn.textContent = orig; }
    if (text) renderProposal(text);
  }

  function renderProposal(text) {
    const body = document.getElementById('scope-proposal-body');
    if (!body) return;
    const card = document.createElement('div'); card.className = 'scope-prop-card';
    const head = document.createElement('div'); head.className = 'scope-prop-head';
    head.innerHTML = `<span>${L.yourProposal}</span><button class="ra-btn" type="button" data-read-target="#scope-prop-text" data-stop-label="${esc(L.stopReading)}">${L.readItToMe}</button>`;
    const txt = document.createElement('div'); txt.id = 'scope-prop-text'; txt.className = 'scope-prop-text';
    String(text).replace(/\*\*/g, '').replace(/^#+\s*/gm, '').split(/\n\n+/).forEach((para) => {
      const p = document.createElement('p');
      const m = para.match(/^([^:\n]{3,42}:)\s*([\s\S]*)$/);
      if (m) { const b = document.createElement('b'); b.textContent = m[1]; p.appendChild(b); p.appendChild(document.createTextNode(m[2])); }
      else p.textContent = para;
      txt.appendChild(p);
    });
    const cta = document.createElement('div'); cta.className = 'scope-prop-cta';
    cta.innerHTML = `<a href="#scope-lead" class="btn-solid green" id="scope-prop-accept">${L.acceptWriting}</a><a href="book.html" class="btn-ghost" data-evt="prop-book">${L.bookCall}</a>`;
    card.appendChild(head); card.appendChild(txt); card.appendChild(cta);
    body.innerHTML = ''; body.appendChild(card);
    const acc = document.getElementById('scope-prop-accept');
    if (acc) acc.addEventListener('click', () => { const inp = document.getElementById('scope-email-input'); if (inp) setTimeout(() => { try { inp.focus(); } catch (e) { /* ignore */ } }, 450); });
  }

  async function onLeadSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('scope-email-input');
    const status = document.getElementById('scope-send-status');
    const email = ((input && input.value) || '').trim();
    if (!email) return;
    const keys = keysFromAnswers(answers);
    const plan = computePlan(keys, segmentFromAnswers());
    const hasPlan = keys.length > 0;
    if (status) { status.style.color = '#8E8882'; status.textContent = L.sending; }
    let ok = false;
    let emailed = false;
    try {
      const r = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          prospectId: prospectId(),
          source: 'scope-studio',
          feature: hasPlan ? plan.items.map((i) => i.name).join(', ') : 'scoping',
          plan: { keys, segment: plan.segment, total: plan.totalBand },
        }),
      });
      const j = await r.json().catch(() => ({}));
      ok = !!(r && r.ok && j && j.ok !== false);
      emailed = !!(j && j.emailed);
    } catch { ok = false; }
    if (ok) {
      track('lead_captured', { emailed, hasPlan });
      if (hasPlan) {
        fetch('/api/proposal', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prospectId: prospectId(), email, plan: { keys, segment: plan.segment, totalBand: plan.totalBand } }) }).catch(() => {});
      }
      // Only claim inbox delivery when a mail actually went out. Otherwise promise a personal
      // follow-up (the lead is captured either way), and never claim a "plan" with no plan.
      if (status) {
        status.style.color = '#10b981';
        status.textContent = hasPlan
          ? (emailed ? L.statusEmailed : L.statusCaptured)
          : L.statusNoPlan;
      }
      if (input) input.disabled = true;
      const send = document.getElementById('scope-send');
      if (send) send.disabled = true;
      leadForm.reset();
    } else if (status) {
      // No working endpoint (static host / not yet deployed) — the "open in your email app" link is still there.
      status.style.color = '#F59E0B';
      status.textContent = L.statusFail;
    }
  }

  // Builds the persistent flow shell (progress stepper + bar + stage) once, then
  // renders the first question. Kept named renderQuestions() — the init call is unchanged.
  function renderQuestions() {
    const N = QUESTIONS.length;
    qMount.innerHTML = `
      <div class="scope-flow" role="group" aria-roledescription="questionnaire" aria-label="Scope your project">
        <div class="scope-flow-head">
          <div class="sf-steps" id="sf-steps" aria-hidden="true"></div>
          <div class="sf-progress mono" id="sf-progress" role="progressbar" aria-valuemin="1" aria-valuemax="${N}" aria-valuenow="1" aria-label="${UI.q} 1 ${UI.of} ${N}"></div>
        </div>
        <div class="sf-bar" aria-hidden="true"><span class="sf-bar-fill" id="sf-bar-fill"></span></div>
        <div class="scope-stage" id="scope-stage"></div>
      </div>`;
    renderStep(0, 0);
  }

  function stepEnterClass(dir) {
    if (REDUCED) return '';
    return dir < 0 ? ' sf-in-back' : ' sf-in';
  }

  function updateProgress(i) {
    const N = QUESTIONS.length;
    const done = i >= N;
    const pb = document.getElementById('sf-progress');
    if (pb) {
      pb.setAttribute('aria-valuenow', String(done ? N : i + 1));
      pb.setAttribute('aria-label', done ? UI.done : `${UI.q} ${i + 1} ${UI.of} ${N}`);
      pb.innerHTML = done ? `<span class="sf-count"><b>${UI.done}</b></span>` : `<span class="sf-count"><b>${UI.q} ${i + 1}</b> ${UI.of} ${N}</span>`;
    }
    const steps = document.getElementById('sf-steps');
    if (steps) steps.innerHTML = QUESTIONS.map((_, k) => `<i class="sf-dot${done || k < i ? ' done' : k === i ? ' on' : ''}"></i>`).join('');
    const fill = document.getElementById('sf-bar-fill');
    if (fill) fill.style.width = `${Math.round(((done ? N : i + 1) / N) * 100)}%`;
  }

  function renderStep(i, dir) {
    clearTimeout(advTimer);
    step = i;
    const q = QUESTIONS[i];
    const stage = document.getElementById('scope-stage');
    if (!stage) return;
    const multi = !!q.multi;
    const sel = answers[q.id] || [];
    const role = multi ? 'checkbox' : 'radio';
    const opts = q.options.map((o) => {
      const on = sel.includes(o.id);
      return `<button type="button" class="scope-opt${on ? ' is-on' : ''}" role="${role}" data-q="${q.id}" data-id="${o.id}" data-multi="${multi}" aria-checked="${on}" tabindex="-1" style="--tc:${optionColor(o)}">
          <span class="opt-mark" aria-hidden="true"></span>
          <span class="opt-label">${esc(o.label)}</span>
        </button>`;
    }).join('');
    stage.innerHTML = `
      <div class="scope-step${stepEnterClass(dir)}" data-step="${i}">
        <h2 class="sf-prompt" id="sf-prompt" tabindex="-1">${esc(q.prompt)}</h2>
        ${multi ? `<p class="sf-hint"><span class="sf-hint-ico" aria-hidden="true">${CHECK}</span>${UI.pick}</p>` : ''}
        <div class="scope-opts ${multi ? 'is-multi' : 'is-single'}" role="${multi ? 'group' : 'radiogroup'}" aria-label="${esc(q.prompt)}">
          ${opts}
        </div>
        <div class="sf-nav">
          <button type="button" class="sf-btn sf-back" id="sf-back">${ARROW_L}${UI.back}</button>
          <button type="button" class="sf-btn sf-next" id="sf-next">${i === QUESTIONS.length - 1 ? UI.see : UI.next}${ARROW_R}</button>
        </div>
      </div>`;
    updateProgress(i);
    // wire options (roving tabindex: only the selected/first option is tabbable)
    const optEls = [...stage.querySelectorAll('.scope-opt')];
    optEls.forEach((b) => { b.addEventListener('click', onPick); b.addEventListener('keydown', onOptKey); });
    const firstFocusable = optEls.find((b) => b.classList.contains('is-on')) || optEls[0];
    if (firstFocusable) firstFocusable.tabIndex = 0;
    const back = document.getElementById('sf-back');
    const next = document.getElementById('sf-next');
    if (back) back.addEventListener('click', goBack);
    if (next) next.addEventListener('click', goNext);
    focusPrompt();
  }

  function onPick(e) {
    chatKeys = null; // touching the questionnaire hands control back to it
    chatSegment = null;
    const b = e.currentTarget;
    const q = b.dataset.q;
    const id = b.dataset.id;
    const multi = b.dataset.multi === 'true';
    const stage = document.getElementById('scope-stage');
    answers[q] = answers[q] || [];
    if (multi) {
      const i = answers[q].indexOf(id);
      if (i >= 0) answers[q].splice(i, 1);
      else answers[q].push(id);
    } else {
      answers[q] = answers[q][0] === id ? [] : [id];
      if (stage) stage.querySelectorAll(`.scope-opt[data-q="${q}"]`).forEach((x) => setPressed(x, false));
    }
    setPressed(b, answers[q].includes(id));
    renderPlan();
    // single-select: one choice moves the flow on (Typeform-style), after the pick pops
    if (!multi && answers[q].length) {
      clearTimeout(advTimer);
      advTimer = setTimeout(goNext, REDUCED ? 0 : 340);
    }
  }

  // Arrow/Home/End roving focus inside the current option group; Enter/Space activate natively.
  function onOptKey(e) {
    const group = e.currentTarget.closest('.scope-opts');
    if (!group) return;
    const opts = [...group.querySelectorAll('.scope-opt')];
    const cur = opts.indexOf(e.currentTarget);
    let ni = -1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') ni = (cur + 1) % opts.length;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') ni = (cur - 1 + opts.length) % opts.length;
    else if (e.key === 'Home') ni = 0;
    else if (e.key === 'End') ni = opts.length - 1;
    if (ni < 0) return;
    e.preventDefault();
    opts.forEach((o) => { o.tabIndex = -1; });
    opts[ni].tabIndex = 0;
    try { opts[ni].focus(); } catch (err) { /* focus optional */ }
  }

  function goNext() {
    clearTimeout(advTimer);
    if (step < QUESTIONS.length - 1) renderStep(step + 1, 1);
    else showReview();
  }

  function goBack() {
    clearTimeout(advTimer);
    if (step > 0) renderStep(step - 1, -1);
    else exitToChooser();
  }

  function goTo(i) {
    clearTimeout(advTimer);
    renderStep(Math.max(0, Math.min(QUESTIONS.length - 1, i)), 0);
  }

  // Done panel — the reveal after the last question. The live plan/blueprint already
  // rendered on each pick; this focuses the visitor on it and offers the email handoff.
  function showReview() {
    const stage = document.getElementById('scope-stage');
    if (!stage) return;
    step = QUESTIONS.length;
    updateProgress(step);
    const has = !!(curPlan && curPlan.count);
    stage.innerHTML = `
      <div class="scope-step scope-done${REDUCED ? '' : ' sf-in'}">
        <span class="sf-done-ico${has ? ' on' : ''}" aria-hidden="true">${CHECK}</span>
        <h2 class="sf-prompt" id="sf-prompt" tabindex="-1">${has ? L.planReady : L.oneMore}</h2>
        <p class="sf-done-copy">${has ? L.doneHas : L.doneEmpty}</p>
        <div class="sf-nav">
          <button type="button" class="sf-btn sf-back" id="sf-back">${ARROW_L}${UI.edit}</button>
          ${has
            ? `<a href="#scope-handoff" class="sf-btn sf-next" id="sf-done-cta" data-evt="scope-done-cta">${L.emailPlan}${ARROW_R}</a>`
            : `<button type="button" class="sf-btn sf-next" id="sf-next">${L.pickBuild}${ARROW_R}</button>`}
      </div>
      </div>`;
    const back = document.getElementById('sf-back');
    if (back) back.addEventListener('click', () => renderStep(QUESTIONS.length - 1, -1));
    const next = document.getElementById('sf-next');
    if (next) next.addEventListener('click', () => goTo(1)); // the "what do you want to happen?" question
    focusPrompt();
    if (has) revealPlan();
  }

  function revealPlan() {
    if (REDUCED) return;
    if (window.matchMedia && window.matchMedia('(max-width:900px)').matches) {
      const c = document.getElementById('scope-canvas');
      if (c && c.scrollIntoView) { try { c.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { /* optional */ } }
    }
  }

  function focusPrompt() {
    if (root.dataset.entry !== 'quick') return; // don't steal focus while the chooser is up
    const p = document.getElementById('sf-prompt');
    if (!p) return;
    try { p.focus({ preventScroll: true }); } catch (e) { try { p.focus(); } catch (_) { /* optional */ } }
  }

  function setPressed(btn, on) {
    btn.setAttribute('aria-checked', String(on));
    btn.classList.toggle('is-on', on);
  }

  function segmentFromAnswers() {
    const s = (answers.segment || [])[0];
    return { 'seg-service': 'service-business', 'seg-aiproduct': 'ai-product', 'seg-ops': 'ops-automation', 'seg-product': 'product-build' }[s] || null;
  }

  function renderPlan() {
    const keys = chatKeys !== null ? chatKeys : keysFromAnswers(answers);
    const segment = chatKeys !== null ? (chatSegment || segmentFromAnswers()) : segmentFromAnswers();
    const plan = computePlan(keys, segment);
    window.__renderScopePlan(plan);
    curKeys = keys; curSegment = segment; curPlan = plan;
    const propWrap = document.getElementById('scope-proposal');
    if (propWrap) propWrap.hidden = !plan.count;
    const propBody = document.getElementById('scope-proposal-body');
    if (propBody) propBody.innerHTML = ''; // clear a stale narrative when the plan changes
    syncUrl();
    root.setAttribute('data-state', keys.length ? 'plan' : 'discovery');
    updateHandoff(plan);
    if (keys.length) {
      playPlanReady();
      // Snapshot the plan to localStorage so a returning visitor can be offered a warm
      // "pick up where you left off" (read by the gateway + the concierge). Their own data.
      try {
        if (plan.count) {
          let hash = '';
          try { const ids = selectedOptionIds(); if (ids.length) hash = encodeKeys(ids); } catch (e) { /* chat-mode plans have no option ids */ }
          localStorage.setItem('jt-scope-snapshot', JSON.stringify({
            names: plan.items.map((i) => i.name), band: band(plan.totalBand), hash, ts: Date.now()
          }));
        }
      } catch (e) { /* storage optional */ }
      clearTimeout(planTrackTimer);
      planTrackTimer = setTimeout(() => {
        track('plan_built', { plan: { keys, segment, total: plan.totalBand } });
      }, 600);
    }
  }

  function planSummaryText(plan) {
    const lines = plan.items.map((i) => `• ${i.name} · ${band(i.band)} (${i.effort})`);
    return `${L.summHead}\n\n${lines.join('\n')}\n\n${L.summTotal} ${band(plan.totalBand)} · ~${plan.timelineWeeks[0]}–${plan.timelineWeeks[1]} ${L.summWeeks}\n${L.summNote}\n\n${L.summShared} ${location.href}`;
  }

  function updateHandoff(plan) {
    const email = document.getElementById('scope-email');
    if (email) {
      const subj = encodeURIComponent('My scoped plan · via the site');
      const body = encodeURIComponent(plan.count ? planSummaryText(plan) : 'I started scoping on your site and want to talk.');
      email.setAttribute('href', `mailto:hello@sageideas.dev?subject=${subj}&body=${body}`);
      if (!email.dataset.wired) {
        email.dataset.wired = '1';
        email.addEventListener('click', () => track('handoff_clicked', { meta: { kind: 'email' } }));
      }
    }
    const copy = document.getElementById('scope-copy');
    if (copy && !copy.dataset.wired) {
      copy.dataset.wired = '1';
      copy.addEventListener('click', async () => {
        track('handoff_clicked', { meta: { kind: 'copy' } });
        try {
          await navigator.clipboard.writeText(location.href);
          copy.textContent = L.copied;
          setTimeout(() => { copy.textContent = L.copyLink; }, 1600);
        } catch {
          // Clipboard API unavailable (e.g. insecure context) — link is still visible to copy manually.
        }
      });
    }
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
    // #caps= carries capability keys (seg~keys) handed off from the concierge's in-chat
    // scoping — render the SAME visual blueprint the questionnaire builds, pre-loaded.
    const mc = location.hash.match(/caps=([^&]+)/);
    if (mc) {
      const { keys, segment } = decodeKeys(mc[1]);
      if (keys && keys.length) { chatKeys = keys.filter(Boolean); chatSegment = segment || null; return; }
    }
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
