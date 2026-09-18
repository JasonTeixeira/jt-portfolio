// Branded transactional email templates. One light, table-based, inline-styled shell
// (maximum client compatibility + deliverability) with a dark header bar and the brand
// green accent. Every builder returns { subject, text, html } so callers keep a plain-text
// fallback. Keep these transactional (no marketing, no List-Unsubscribe) — receipts,
// invoices, reset links, contracts, message nudges.
import { money } from '../assets/proposal-core.mjs';
import { locDisclaimer } from '../assets/scope-i18n.mjs';

const BRAND = 'Sage Ideas';
const SIGNOFF = 'Jason · Sage Ideas';
const INK = '#1A1A1A';
const MUTED = '#6B6B6B';
const GREEN = '#0F9D6C';
const LINE = '#E7E4DF';
const BG = '#F4F2EF';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// Only http(s) links may become a clickable CTA — belt-and-suspenders against a future
// caller ever passing a non-server-derived URL (esc() already blocks attribute breakout,
// but this also neutralizes javascript:/data: URIs).
const isHttp = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);

// The one shell. `bodyRows` is trusted HTML the builders assemble from escaped parts.
function shell({ preheader, heading, bodyRows, ctaLabel, ctaUrl }) {
  const cta = ctaLabel && isHttp(ctaUrl) ? `
        <tr><td style="padding:8px 0 4px">
          <a href="${esc(ctaUrl)}" style="display:inline-block;background:${GREEN};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:10px">${esc(ctaLabel)}</a>
        </td></tr>
        <tr><td style="padding:6px 0 0;font-size:12px;color:${MUTED};word-break:break-all">Or paste this link: ${esc(ctaUrl)}</td></tr>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader || heading)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:28px 12px">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid ${LINE};border-radius:16px;overflow:hidden">
      <tr><td style="background:#0C0C0E;padding:18px 28px">
        <span style="color:#ffffff;font-weight:700;font-size:15px;letter-spacing:.02em">${esc(BRAND)}</span>
        <span style="color:${GREEN};font-weight:700;font-size:15px"> ·</span>
      </td></tr>
      <tr><td style="padding:30px 28px 28px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="font-size:21px;font-weight:700;line-height:1.3;padding-bottom:12px">${esc(heading)}</td></tr>
          ${bodyRows}
          ${cta}
        </table>
      </td></tr>
      <tr><td style="border-top:1px solid ${LINE};padding:18px 28px;font-size:12px;color:${MUTED}">
        ${esc(SIGNOFF)}<br>You're receiving this because you have an active project or account with ${esc(BRAND)}.
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

const para = (html) => `<tr><td style="font-size:15px;line-height:1.6;color:${INK};padding-bottom:14px">${html}</td></tr>`;
const amountRow = (label, value, strong) => `<tr><td style="padding:6px 0;border-bottom:1px solid ${LINE}"><table role="presentation" width="100%"><tr><td style="font-size:14px;color:${MUTED}">${esc(label)}</td><td align="right" style="font-size:${strong ? '16px' : '14px'};font-weight:${strong ? '700' : '500'};color:${strong ? GREEN : INK}">${esc(value)}</td></tr></table></td></tr>`;

export function invoiceEmail({ invoiceNo, amountCents, kind, link }) {
  const kindLabel = kind === 'balance' ? 'balance due' : kind === 'deposit' ? 'deposit' : 'amount due';
  return {
    subject: `Invoice INV-${invoiceNo} — ${money(amountCents)} ${kindLabel}`,
    text: `Invoice INV-${invoiceNo}\n${money(amountCents)} (${kind})\n\nReview and pay securely in your project portal:\n${link}\n\nThank you,\n${SIGNOFF}`,
    html: shell({ preheader: `Invoice INV-${invoiceNo} for ${money(amountCents)}`, heading: `Invoice INV-${invoiceNo}`,
      bodyRows: para('Here are the details for this invoice. You can review and pay securely in your project portal.') +
        amountRow('Invoice', `INV-${invoiceNo}`) + amountRow(kindLabel[0].toUpperCase() + kindLabel.slice(1), money(amountCents), true),
      ctaLabel: 'Review & pay', ctaUrl: link }),
  };
}

export function receiptEmail({ kind, amountCents, totalCents, link }) {
  const paidInFull = kind === 'balance';
  return {
    subject: paidInFull ? 'Payment received — paid in full' : "Deposit received. We're starting.",
    text: paidInFull
      ? `Thank you — your balance payment of ${money(amountCents)} came through and your project is paid in full (total ${money(totalCents)}).\n\nYour itemized receipt is in your project portal.\n${link}\n\n— ${SIGNOFF}`
      : `Thanks. Your deposit of ${money(amountCents)} came through and the work is booked. The balance (${money(totalCents)}) is invoiced on delivery.\n\n${link}\n\n— ${SIGNOFF}`,
    html: shell({ preheader: paidInFull ? 'Paid in full' : 'Deposit received', heading: paidInFull ? 'Paid in full — thank you' : "Deposit received. We're starting.",
      bodyRows: para(paidInFull
        ? `Your balance payment came through and your project is now <strong>paid in full</strong>. Your itemized receipt lives in your portal.`
        : `Your deposit came through and the work is booked. I'll reach out within one business day to line up kickoff. The balance is invoiced on delivery.`) +
        amountRow(paidInFull ? 'Balance paid' : 'Deposit paid', money(amountCents), true) +
        (paidInFull ? amountRow('Project total', money(totalCents)) : amountRow('Balance (on delivery)', money(totalCents))),
      ctaLabel: 'Open your portal', ctaUrl: link }),
  };
}

export function resetEmail({ link }) {
  return {
    subject: 'Reset your password · Sage Ideas',
    text: `Use the secure link below to set a new password. It expires shortly and can be used once.\n\nReset your password:\n${link}\n\nIf you didn't request this, you can safely ignore this email.\n\n— ${SIGNOFF}`,
    html: shell({ preheader: 'Reset your password', heading: 'Reset your password',
      bodyRows: para('Use the button below to set a new password. This link expires shortly and can be used once.') +
        para(`<span style="color:${MUTED};font-size:13px">If you didn't request this, you can safely ignore this email — nothing changes.</span>`),
      ctaLabel: 'Set a new password', ctaUrl: link }),
  };
}

export function confirmEmail({ link }) {
  return {
    subject: 'Confirm your account · Sage Ideas',
    text: `Welcome — confirm your email to activate your account and open your project portal. This link expires shortly and can be used once.\n\nConfirm your account:\n${link}\n\n— ${SIGNOFF}`,
    html: shell({ preheader: 'Confirm your account', heading: 'Confirm your account',
      bodyRows: para('Welcome. Confirm your email to activate your account and open your project portal. This link expires shortly and can be used once.'),
      ctaLabel: 'Confirm your account', ctaUrl: link }),
  };
}

export function contractEmail({ link }) {
  return {
    subject: 'Your agreement is ready to sign',
    text: `Your project agreement is ready. Review and sign it here:\n${link}\n\n— ${SIGNOFF}`,
    html: shell({ preheader: 'Your agreement is ready to sign', heading: 'Your agreement is ready',
      bodyRows: para('Your project agreement is ready to review and sign. It lays out scope, timeline, and terms — no surprises.'),
      ctaLabel: 'Review & sign', ctaUrl: link }),
  };
}

export function messageEmail({ body, link }) {
  const snippet = String(body || '').slice(0, 600);
  return {
    subject: 'New message about your project',
    text: `Jason sent you a message about your project:\n\n"${snippet}"\n\nRead and reply in your project portal:\n${link}\n\n— ${SIGNOFF}`,
    html: shell({ preheader: 'New message about your project', heading: 'New message about your project',
      bodyRows: para(`<div style="background:${BG};border-radius:10px;padding:14px 16px;font-size:15px;line-height:1.55;color:${INK}">${esc(snippet)}</div>`),
      ctaLabel: 'Read & reply', ctaUrl: link }),
  };
}

export function deliveryEmail({ link, what }) {
  const subj = what ? `Ready for you: ${what}` : 'A new update on your project';
  return {
    subject: subj,
    text: `${what ? `"${what}" is ready to review in your project portal.` : 'There\'s a new update in your project portal.'}\n\n${link}\n\n— ${SIGNOFF}`,
    html: shell({ preheader: subj, heading: what ? `${what} is ready` : 'A new update on your project',
      bodyRows: para(what ? `<strong>${esc(what)}</strong> is ready to review in your project portal. Take a look when you have a moment.` : 'There’s a new update waiting in your project portal.'),
      ctaLabel: 'Open your portal', ctaUrl: link }),
  };
}

export function proposalReadyEmail({ link, depositCents }) {
  return {
    subject: 'Your project proposal is ready',
    text: `Your proposal is ready to review${depositCents ? ` — a ${money(depositCents)} deposit books the work` : ''}.\n\n${link}\n\n— ${SIGNOFF}`,
    html: shell({ preheader: 'Your project proposal is ready', heading: 'Your proposal is ready',
      bodyRows: para(`Your project proposal is ready to review — scope, price, and timeline in one place.${depositCents ? ` A ${money(depositCents)} deposit books the work.` : ''}`),
      ctaLabel: 'Review your proposal', ctaUrl: link }),
  };
}

// Newsletter broadcast: a MARKETING email (unlike the transactional shell above), so it
// carries a visible unsubscribe link + a List-Unsubscribe header. `heading` and `bodyText`
// come from the operator; bodyText is plain text rendered into escaped paragraphs, so a
// broadcast can never inject markup. An optional CTA and a required unsubscribeUrl.
export function broadcastEmail({ subject, heading, bodyText, ctaLabel, ctaUrl, unsubscribeUrl, preheader }) {
  const paras = String(bodyText || '').split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
    .map((p) => para(esc(p).replace(/\n/g, '<br>'))).join('');
  const cta = ctaLabel && isHttp(ctaUrl) ? `
        <tr><td style="padding:8px 0 4px">
          <a href="${esc(ctaUrl)}" style="display:inline-block;background:${GREEN};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:10px">${esc(ctaLabel)}</a>
        </td></tr>` : '';
  const unsub = isHttp(unsubscribeUrl) ? unsubscribeUrl : '';
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader || heading)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:28px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${LINE};border-radius:16px;overflow:hidden">
    <tr><td style="background:#0C0C0E;padding:18px 28px"><span style="color:#ffffff;font-weight:700;font-size:15px;letter-spacing:.02em">${esc(BRAND)}</span><span style="color:${GREEN};font-weight:700;font-size:15px"> ·</span></td></tr>
    <tr><td style="padding:30px 28px 26px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td style="font-size:22px;font-weight:700;line-height:1.3;padding-bottom:14px">${esc(heading)}</td></tr>
      ${paras}${cta}
    </table></td></tr>
    <tr><td style="border-top:1px solid ${LINE};padding:18px 28px;font-size:12px;color:${MUTED}">
      ${esc(SIGNOFF)}<br>You're getting this because you subscribed to field notes from ${esc(BRAND)}.${unsub ? ` <a href="${esc(unsub)}" style="color:${MUTED}">Unsubscribe</a>.` : ''}
    </td></tr>
  </table>
</td></tr></table></body></html>`;
  const text = `${heading}\n\n${bodyText || ''}${ctaLabel && isHttp(ctaUrl) ? `\n\n${ctaLabel}: ${ctaUrl}` : ''}\n\n— ${SIGNOFF}${unsub ? `\n\nUnsubscribe: ${unsub}` : ''}`;
  const headers = unsub ? { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : undefined;
  return { subject, heading, text, html, headers };
}

// The visitor's own scoped plan, delivered to their inbox: itemized capabilities grouped by
// phase with indicative bands (dollars, not cents), a total range, a timeline, the honest
// "indicative, not a quote" disclaimer, and a book-a-call CTA. Bands come from the static
// rate card (never generated). Callers pass an already-computed plan (computePlan output).
// Localized visitor-facing copy for the scoped-plan email. English (en) values are kept
// byte-identical to the original strings so existing callers are unaffected; es/pt are
// professional, natural translations (ES informal "tú", PT "você") matching the site's voice.
// Dynamic values (the $ audit price `a`, the shareable plan url `u`, and the localized
// segment fragment `seg`) are injected by the template functions. The itemized rows and
// phase labels are localized upstream (api/lead.js) and passed in already-localized.
const SCOPE_EMAIL_COPY = {
  en: {
    subject: 'Your scoped plan',
    heading: 'Your scoped plan',
    preheader: (a) => `Start here — ${a} AI Quality Audit, credited into the build`,
    intro: (seg) => `Here's the plan you just scoped${seg ? ` for your ${seg}` : ''}. Everything below is grounded in a fixed rate card, so these ranges are honest, not made up on the spot.`,
    startHere: 'Start here',
    auditTitle: (a) => `${a} AI Quality Audit`,
    auditDesc: `A fixed-price audit week: I dig into your setup and hand you a written plan + a firm quote. It's <strong>credited into the build</strong>, so the real cost of starting is <strong>$0</strong>.`,
    fullBuild: 'Full build (indicative)',
    typical: 'Typical',
    timeline: 'Rough timeline',
    weeks: (lo, hi) => `~${lo}–${hi} weeks`,
    nextSteps: (a) => `<b>What happens next:</b> start with the ${a} audit above — it's credited into the build, so the real cost of starting is $0 — or book a 15-minute call below and I'll turn this into a firm proposal: fixed scope, fixed price, a start date. No obligation, and I only take one engagement at a time so you'll always talk to me, not a queue.`,
    planLinkLabel: 'Your shareable plan link:',
    cta: 'Book a 15-min call',
    disclaimerFallback: 'Indicative ranges, not a quote. Exact scope and price are locked on a short call.',
    textIntro: `Here's the plan you just scoped.`,
    textStartHere: (a) => `START HERE — ${a} AI Quality Audit`,
    textAuditDesc: `A fixed-price audit week: a written plan + a firm quote, credited into the build — so the real cost of starting is $0.`,
    textNextSteps: (a, u) => `Start with the ${a} audit (credited into the build) or book a 15-minute call: ${u}`,
  },
  es: {
    subject: 'Tu plan personalizado',
    heading: 'Tu plan personalizado',
    preheader: (a) => `Empieza aquí — Auditoría de Calidad de IA de ${a}, acreditada al proyecto`,
    intro: (seg) => `Este es el plan que acabas de definir${seg ? ` para tu ${seg}` : ''}. Todo lo de abajo se basa en una tarifa fija, así que estos rangos son honestos, no inventados sobre la marcha.`,
    startHere: 'Empieza aquí',
    auditTitle: (a) => `Auditoría de Calidad de IA de ${a}`,
    auditDesc: `Una semana de auditoría a precio fijo: analizo tu configuración y te entrego un plan por escrito + un presupuesto en firme. Se <strong>acredita al proyecto</strong>, así que el costo real de empezar es <strong>$0</strong>.`,
    fullBuild: 'Proyecto completo (indicativo)',
    typical: 'Típico',
    timeline: 'Plazo aproximado',
    weeks: (lo, hi) => `~${lo}–${hi} semanas`,
    nextSteps: (a) => `<b>Qué sigue:</b> empieza con la auditoría de ${a} de arriba — se acredita al proyecto, así que el costo real de empezar es $0 — o agenda una llamada de 15 minutos abajo y la convierto en una propuesta en firme: alcance fijo, precio fijo, una fecha de inicio. Sin compromiso, y solo tomo un proyecto a la vez, así que siempre hablarás conmigo, no con una fila.`,
    planLinkLabel: 'Tu enlace del plan para compartir:',
    cta: 'Agenda una llamada de 15 min',
    disclaimerFallback: 'Rangos indicativos, no un presupuesto. El alcance y el precio exactos se definen en una llamada breve.',
    textIntro: `Este es el plan que acabas de definir.`,
    textStartHere: (a) => `EMPIEZA AQUÍ — Auditoría de Calidad de IA de ${a}`,
    textAuditDesc: `Una semana de auditoría a precio fijo: un plan por escrito + un presupuesto en firme, acreditado al proyecto — así que el costo real de empezar es $0.`,
    textNextSteps: (a, u) => `Empieza con la auditoría de ${a} (acreditada al proyecto) o agenda una llamada de 15 minutos: ${u}`,
  },
  pt: {
    subject: 'Seu plano personalizado',
    heading: 'Seu plano personalizado',
    preheader: (a) => `Comece aqui — Auditoria de Qualidade de IA de ${a}, creditada no projeto`,
    intro: (seg) => `Este é o plano que você acabou de montar${seg ? ` para o seu ${seg}` : ''}. Tudo abaixo se baseia em uma tabela de preços fixa, então essas faixas são honestas, não inventadas na hora.`,
    startHere: 'Comece aqui',
    auditTitle: (a) => `Auditoria de Qualidade de IA de ${a}`,
    auditDesc: `Uma semana de auditoria com preço fixo: eu mergulho na sua configuração e te entrego um plano por escrito + um orçamento fechado. É <strong>creditada no projeto</strong>, então o custo real de começar é <strong>$0</strong>.`,
    fullBuild: 'Projeto completo (indicativo)',
    typical: 'Típico',
    timeline: 'Prazo aproximado',
    weeks: (lo, hi) => `~${lo}–${hi} semanas`,
    nextSteps: (a) => `<b>O que acontece agora:</b> comece com a auditoria de ${a} acima — ela é creditada no projeto, então o custo real de começar é $0 — ou agende uma conversa de 15 minutos abaixo e eu transformo isto em uma proposta fechada: escopo fixo, preço fixo, uma data de início. Sem compromisso, e eu só assumo um projeto por vez, então você sempre vai falar comigo, não com uma fila.`,
    planLinkLabel: 'Seu link do plano para compartilhar:',
    cta: 'Agende uma conversa de 15 min',
    disclaimerFallback: 'Faixas indicativas, não um orçamento. O escopo e o preço exatos são definidos em uma conversa rápida.',
    textIntro: `Este é o plano que você acabou de montar.`,
    textStartHere: (a) => `COMECE AQUI — Auditoria de Qualidade de IA de ${a}`,
    textAuditDesc: `Uma semana de auditoria com preço fixo: um plano por escrito + um orçamento fechado, creditado no projeto — então o custo real de começar é $0.`,
    textNextSteps: (a, u) => `Comece com a auditoria de ${a} (creditada no projeto) ou agende uma conversa de 15 minutos: ${u}`,
  },
};

export function scopePlanEmail({ segmentLabel, phases, totalBand, timelineWeeks, bookUrl, planUrl, disclaimer, auditPrice = 497, lang = 'en' }) {
  const t = SCOPE_EMAIL_COPY[lang] || SCOPE_EMAIL_COPY.en;
  const usd = (n) => '$' + Number(n || 0).toLocaleString('en-US');
  const range = (b) => (Array.isArray(b) && b.length === 2 && Number.isFinite(b[0])) ? `${usd(b[0])} – ${usd(b[1])}` : '';
  // The on-page anchor: the arithmetic mean of the full-build band, shown as "typical ~$X".
  const midpoint = (Array.isArray(totalBand) && totalBand.length === 2 && Number.isFinite(totalBand[0]) && Number.isFinite(totalBand[1]))
    ? Math.round((totalBand[0] + totalBand[1]) / 2) : null;
  const auditUsd = usd(auditPrice);
  const weeks = (Array.isArray(timelineWeeks) && timelineWeeks[1]) ? t.weeks(timelineWeeks[0], timelineWeeks[1]) : '';
  // Pricing stays deterministic; only DISPLAY copy localizes. The disclaimer falls back to the
  // localized default (or a passed-in disclaimer) via locDisclaimer.
  const disc = locDisclaimer(lang, disclaimer || t.disclaimerFallback);
  const segFrag = segmentLabel ? esc(segmentLabel).toLowerCase() : '';
  const phaseRows = (phases || []).map((p) => (
    `<tr><td colspan="2" style="padding:18px 0 4px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${GREEN}">${esc(p.label)}</td></tr>` +
    (p.items || []).map((i) => `<tr><td style="padding:8px 0;border-bottom:1px solid ${LINE};font-size:14px;color:${INK};vertical-align:top">${esc(i.name)}<div style="font-size:12px;color:${MUTED};margin-top:2px">${esc(i.why || '')}</div></td><td align="right" style="padding:8px 0 8px 14px;border-bottom:1px solid ${LINE};font-size:13px;color:${MUTED};white-space:nowrap;vertical-align:top">${range(i.band)}</td></tr>`).join('')
  )).join('');
  // The low-commitment "start here" rung: a highlighted box (table + inline styles, no CSS)
  // that leads with the fixed-price audit, credited into the build, before the full-build range.
  const auditRung =
    `<tr><td style="padding:2px 0 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEFBF5;border:1px solid ${GREEN};border-radius:12px"><tr><td style="padding:15px 18px">` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>` +
        `<td style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${GREEN};font-weight:700">${esc(t.startHere)}</td>` +
        `<td align="right" style="font-size:19px;font-weight:700;color:${GREEN}">${esc(auditUsd)}</td>` +
      `</tr></table>` +
      `<div style="font-size:15px;font-weight:700;color:${INK};margin-top:7px">${esc(t.auditTitle(auditUsd))}</div>` +
      `<div style="font-size:13px;line-height:1.55;color:${INK};margin-top:5px">${t.auditDesc}</div>` +
    `</td></tr></table></td></tr>`;
  const bodyRows =
    para(t.intro(segFrag)) +
    auditRung +
    phaseRows +
    amountRow(t.fullBuild, range(totalBand), true) +
    (midpoint ? amountRow(t.typical, `~${usd(midpoint)}`) : '') +
    (weeks ? amountRow(t.timeline, weeks) : '') +
    para(`<span style="color:${MUTED};font-size:13px">${esc(disc)}</span>`) +
    para(t.nextSteps(esc(auditUsd))) +
    (isHttp(planUrl) ? para(`<span style="color:${MUTED};font-size:12px">${esc(t.planLinkLabel)} <a href="${esc(planUrl)}" style="color:${GREEN}">${esc(planUrl)}</a></span>`) : '');
  return {
    subject: `${t.subject}${range(totalBand) ? ` — ${range(totalBand)}` : ''}`,
    text: `${t.textIntro}\n\n${t.textStartHere(auditUsd)}\n${t.textAuditDesc}\n\n${(phases || []).map((p) => `${p.label}\n${(p.items || []).map((i) => `  - ${i.name} (${range(i.band)})`).join('\n')}`).join('\n\n')}\n\n${t.fullBuild}: ${range(totalBand)}${midpoint ? `\n${t.typical}: ~${usd(midpoint)}` : ''}${weeks ? `\n${t.timeline}: ${weeks}` : ''}\n\n${disc}\n\n${t.textNextSteps(auditUsd, bookUrl)}\n\n— ${SIGNOFF}`,
    html: shell({ preheader: t.preheader(auditUsd), heading: t.heading, bodyRows, ctaLabel: t.cta, ctaUrl: bookUrl }),
  };
}
