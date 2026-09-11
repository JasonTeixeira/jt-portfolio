// Pure nurture rules + email templates. Shared browser+node. No I/O.
import { CARD_BY_KEY } from './scope-core.mjs';

// Personalization helpers — name the visitor + what they actually scoped, so the
// follow-up reads like a person who paid attention, not a mail-merge. All from their
// own session data (name they gave, capabilities they picked); never fabricated.
export function firstName(prospect) {
  const n = ((prospect && prospect.name) || '').trim();
  if (!n) return '';
  const f = n.split(/\s+/)[0];
  return /^[\p{L}'’-]{2,20}$/u.test(f) ? f : '';
}
function kMoney(n) { return n >= 1000 ? '$' + Math.round(n / 1000) + 'k' : '$' + n; }
export function bandStr(lo, hi) { return (lo && hi) ? kMoney(lo) + '–' + kMoney(hi) : ''; }
export function planPhrase(plan) {
  if (!plan || !Array.isArray(plan.keys) || !plan.keys.length) return null;
  const names = plan.keys.map((k) => CARD_BY_KEY.get(k)).filter(Boolean).map((c) => c.name.toLowerCase());
  if (!names.length) return null;
  const list = names.length === 1 ? names[0]
    : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
  return { list, band: bandStr(plan.total_lo, plan.total_hi) };
}

export const DUE = { LEAD_HOURS: 48, LEAD2_HOURS: 144, UNPAID_1_DAYS: 3, UNPAID_2_DAYS: 8, EXPIRING_WITHIN_DAYS: 3, DRAFT_STALE_HOURS: 24 };
export const SEND_CAP = 200;
export const STEP = { LEAD: 'lead_no_proposal', LEAD_2: 'lead_no_proposal_2', UNPAID_1: 'proposal_unpaid_1', UNPAID_2: 'proposal_unpaid_2', EXPIRING: 'proposal_expiring' };

export function isSendable(p) { return Boolean(p) && !p.unsubscribed && !p.nurture_suppressed; }
export function hoursBetween(aIso, bIso) { return (new Date(bIso).getTime() - new Date(aIso).getTime()) / 3600e3; }

export function leadDue(prospect, hasProposal, sentSteps, nowIso) {
  if (!prospect || prospect.stage !== 'engaged') return false;
  if (!prospect.email) return false;
  if (hasProposal) return false;
  if (!isSendable(prospect)) return false;
  if (sentSteps && sentSteps.has(STEP.LEAD)) return false;
  if (!prospect.updated_at) return false;
  return hoursBetween(prospect.updated_at, nowIso) >= DUE.LEAD_HOURS;
}

// Second lead touch — a different angle a few days after the first, only if the first went out,
// they still haven't scoped a proposal, and they haven't opted out.
export function lead2Due(prospect, hasProposal, sentSteps, nowIso) {
  if (!prospect || prospect.stage !== 'engaged') return false;
  if (!prospect.email || hasProposal) return false;
  if (!isSendable(prospect)) return false;
  if (!sentSteps || !sentSteps.has(STEP.LEAD) || sentSteps.has(STEP.LEAD_2)) return false;
  if (!prospect.updated_at) return false;
  return hoursBetween(prospect.updated_at, nowIso) >= DUE.LEAD2_HOURS;
}

export function dueStepForProposal(proposal, sentSteps, nowIso) {
  if (!proposal || proposal.status !== 'approved') return null;
  const now = new Date(nowIso).getTime();
  if (proposal.expires_at && new Date(proposal.expires_at).getTime() < now) return null; // expired
  const sent = sentSteps || new Set();
  // C: expiring within window takes priority
  if (proposal.expires_at) {
    const hrsToExpiry = (new Date(proposal.expires_at).getTime() - now) / 3600e3;
    if (hrsToExpiry > 0 && hrsToExpiry <= DUE.EXPIRING_WITHIN_DAYS * 24 && !sent.has(STEP.EXPIRING)) return STEP.EXPIRING;
  }
  if (!proposal.approved_at) return null;
  const ageDays = (now - new Date(proposal.approved_at).getTime()) / 864e5;
  // Send the most-overdue single step, in order, never backward: once UNPAID_2 has gone
  // out we do not loop back to UNPAID_1. A backfilled old proposal (>=8d, nothing sent yet)
  // gets one "still here" nudge, not a stale "sent this a few days ago".
  if (ageDays >= DUE.UNPAID_2_DAYS && !sent.has(STEP.UNPAID_2)) return STEP.UNPAID_2;
  if (ageDays >= DUE.UNPAID_1_DAYS && !sent.has(STEP.UNPAID_1) && !sent.has(STEP.UNPAID_2)) return STEP.UNPAID_1;
  return null;
}

export function listUnsubHeaders(unsubscribeUrl) {
  return { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
}
function footer(unsubscribeUrl) { return `\n\n— Jason Teixeira\nSage Ideas LLC · Orlando, FL\n\nNot interested in these? Unsubscribe: ${unsubscribeUrl}`; }

// ── premium, deliverability-safe HTML email ─────────────────────────────────────
// Light body (renders reliably everywhere), on-brand dark header + green CTA, table
// layout + inline styles for max email-client compatibility (Outlook included). Always
// paired with a plain-text version (below) as the fallback + for text-first clients.
const _SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const _SERIF = "Georgia,'Times New Roman',serif";
const _MONO = "'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace";
function _esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function htmlEmail({ preheader, heading, paras, ctaText, ctaUrl, altText, altUrl, unsubscribeUrl }) {
  const body = (paras || []).map((t) => `<p style="margin:0 0 16px;font-family:${_SANS};font-size:15px;line-height:1.65;color:#3f3f46">${t}</p>`).join('');
  const cta = (ctaText && ctaUrl)
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px 0 4px"><tr><td style="border-radius:12px;background:#10b981"><a href="${ctaUrl}" style="display:inline-block;padding:13px 28px;font-family:${_SANS};font-size:15px;font-weight:700;color:#04120d;text-decoration:none">${ctaText} &rarr;</a></td></tr></table>` : '';
  const alt = (altText && altUrl)
    ? `<p style="margin:12px 0 0;font-family:${_SANS};font-size:13.5px;color:#71717a">${altText} <a href="${altUrl}" style="color:#0ea5b7;text-decoration:none">${_esc(altUrl.replace(/^https?:\/\//, ''))}</a></p>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:#f4f4f5;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${_esc(preheader || '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:28px 12px"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#ffffff;border:1px solid #e4e4e7;border-radius:16px;overflow:hidden">
  <tr><td style="background:#0C0C0E;padding:20px 28px"><span style="font-family:${_MONO};font-weight:700;font-size:15px;color:#F4F2EF"><span style="color:#22d3ee">jason</span>.<span style="color:#a78bfa">teixeira</span>()</span></td></tr>
  <tr><td style="height:3px;background:#10b981"></td></tr>
  <tr><td style="padding:34px 28px 6px">
    <h1 style="margin:0 0 18px;font-family:${_SERIF};font-weight:400;font-size:24px;line-height:1.28;color:#18181b">${heading}</h1>
    ${body}${cta}${alt}
  </td></tr>
  <tr><td style="padding:24px 28px 28px">
    <p style="margin:0;font-family:${_SERIF};font-size:15px;color:#18181b">&mdash; Jason Teixeira</p>
    <p style="margin:4px 0 0;font-family:${_SANS};font-size:12.5px;color:#a1a1aa">AI Automation &times; QA / LLM Evaluation &middot; Sage Ideas LLC</p>
  </td></tr>
  <tr><td style="border-top:1px solid #f0f0f2;padding:18px 28px;background:#fafafa">
    <p style="margin:0;font-family:${_SANS};font-size:11.5px;line-height:1.6;color:#a1a1aa">Sage Ideas LLC &middot; Orlando, FL &middot; <a href="${unsubscribeUrl}" style="color:#a1a1aa">Unsubscribe</a></p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

export function leadEmail({ prospect, hasPlan, plan, siteUrl, unsubscribeUrl }) {
  const first = firstName(prospect);
  const pp = hasPlan ? planPhrase(plan) : null;
  const you = first ? `${first}, you` : 'You';
  const subject = hasPlan ? 'Turning your plan into a firm quote' : 'What would it take to build it?';
  const heading = hasPlan ? 'Want me to turn your plan into a real quote?' : 'Want me to map out what a build would take?';
  let paras;
  if (pp) {
    paras = [
      `${you} scoped ${pp.list} on my site a couple of days ago${pp.band ? `, roughly ${pp.band} indicative` : ''}. Solid picks. If you want, I'll turn that exact list into a firm scope, timeline, and price you can act on. Takes me a few minutes, and there's no obligation.`,
      "What's different about working with me: I don't just build the AI feature, I prove it works. Every number is backed by a test you can see, not a promise."];
  } else if (hasPlan) {
    paras = [
      `${you} scoped a plan on my site a couple of days ago, and the picks were solid. If you'd like, I'll turn it into a firm scope, timeline, and price you can act on. Takes me a few minutes, and there's no obligation.`,
      "What makes working with me different: I don't just build the AI feature, I prove it works. Every number is backed by a test you can see, not a promise."];
  } else {
    paras = [
      `${you} stopped by my site recently. If there's a project on your mind, an AI feature, an automation, or a system that keeps leaking your time, I can map out what it would take and what it would cost. Free, no obligation.`,
      "What makes it different: I build it and I prove it works, with evals and tests you can see. No hand-waving."];
  }
  const text = `${paras.join('\n\n')}\n\nScope it: ${siteUrl}/build.html\nOr book a quick call: ${siteUrl}/book.html` + footer(unsubscribeUrl);
  const html = htmlEmail({ preheader: heading, heading, paras, ctaText: hasPlan ? 'Turn my plan into a quote' : 'Scope it in a few minutes', ctaUrl: `${siteUrl}/build.html`, altText: 'Or grab 15 minutes:', altUrl: `${siteUrl}/book.html`, unsubscribeUrl });
  return { subject, text, html, headers: listUnsubHeaders(unsubscribeUrl) };
}

export function lead2Email({ prospect, hasPlan, siteUrl, unsubscribeUrl }) {
  const first = firstName(prospect);
  const subject = 'The one thing most AI projects get wrong';
  const heading = 'The one thing most AI projects get wrong';
  const paras = [`${first ? first + ', c' : 'C'}ircling back once, then I'll leave you be.`,
    "Most AI and automation work ships on a demo and a prayer. It looks great in the meeting, then a real customer finds the one thing it gets wrong. The fix isn't more AI. It's proof: evals, tests, and a gate that catches the bad output before it ships. That's why my own site runs its quality checks in public.",
    "If there's something you're not fully sure about, that's exactly the conversation to have. Fifteen minutes, no pitch."];
  const text = `Hi,\n\n${paras.join('\n\n')}\n\nBook 15 minutes: ${siteUrl}/book.html\nOr scope it yourself: ${siteUrl}/build.html` + footer(unsubscribeUrl);
  const html = htmlEmail({ preheader: 'Proof is the difference. Fifteen minutes, no pitch.', heading, paras, ctaText: 'Book 15 minutes', ctaUrl: `${siteUrl}/book.html`, altText: 'Or scope it yourself:', altUrl: `${siteUrl}/build.html`, unsubscribeUrl });
  return { subject, text, html, headers: listUnsubHeaders(unsubscribeUrl) };
}

export function unpaidEmail({ proposal, step, siteUrl, unsubscribeUrl }) {
  const link = `${siteUrl}/proposal.html?id=${proposal.public_id}`;
  const first = step === STEP.UNPAID_1;
  const subject = first ? 'Any questions on your proposal?' : "Still here when you're ready";
  const heading = subject;
  const paras = first
    ? ["I sent your proposal a few days ago. Any questions before you decide? I'm happy to jump on a quick call or answer over email, whatever's easier."]
    : ["Still holding your slot. If the timing is off, no pressure at all. Just let me know and I'll set it aside for whenever it's right."];
  const text = `Hi,\n\n${paras.join('\n\n')}\n\nYour proposal: ${link}` + footer(unsubscribeUrl);
  const html = htmlEmail({ preheader: heading, heading, paras, ctaText: 'View your proposal', ctaUrl: link, unsubscribeUrl });
  return { subject, text, html, headers: listUnsubHeaders(unsubscribeUrl) };
}

export function expiringEmail({ proposal, siteUrl, unsubscribeUrl }) {
  const link = `${siteUrl}/proposal.html?id=${proposal.public_id}`;
  let dateStr = '';
  if (proposal.expires_at) {
    const d = new Date(proposal.expires_at);
    if (!Number.isNaN(d.getTime())) dateStr = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  const subject = 'Your proposal expires soon';
  const heading = `Your proposal expires${dateStr ? ` on ${dateStr}` : ' soon'}`;
  const paras = [`Quick heads-up: your proposal expires${dateStr ? ` on ${dateStr}` : ' soon'}. After that, the scope and price may need a refresh.`,
    "If you want to move ahead, it's all still here and ready to accept."];
  const text = `Hi,\n\n${paras.join('\n\n')}\n\nReview and accept: ${link}` + footer(unsubscribeUrl);
  const html = htmlEmail({ preheader: heading, heading, paras, ctaText: 'Review and accept', ctaUrl: link, unsubscribeUrl });
  return { subject, text, html, headers: listUnsubHeaders(unsubscribeUrl) };
}
