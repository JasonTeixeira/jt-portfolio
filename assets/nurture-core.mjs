// Pure nurture rules + email templates. Shared browser+node. No I/O.
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
function footer(unsubscribeUrl) { return `\n\nNot interested in these? Unsubscribe: ${unsubscribeUrl}`; }

export function leadEmail({ prospect, hasPlan, siteUrl, unsubscribeUrl }) {
  const subject = hasPlan ? 'Want me to turn your plan into a real quote?' : 'Want me to map out what a build would take?';
  const body = hasPlan
    ? `Hi,\n\nYou scoped a plan on my site a couple of days ago, nice pick. Want me to turn it into a firm scope, timeline, and price you can act on? Takes me a few minutes and there's no obligation.\n\nThe thing that makes working with me different: I don't just build it, I prove it works. Every claim is backed by a number you can see, not a "trust me".\n\nPick it back up: ${siteUrl}/build.html\nOr grab 15 minutes and we'll talk it through: ${siteUrl}/book.html`
    : `Hi,\n\nYou stopped by my site recently. If there's a project on your mind (an AI feature, an automation, a system that keeps leaking your time), I can map out what it'd take and what it'd cost, free.\n\nWhat makes it different: I build it and I prove it works, with evals and tests you can see. No hand-waving.\n\nScope it in a few minutes: ${siteUrl}/build.html\nOr book a quick call: ${siteUrl}/book.html`;
  return { subject, text: body + footer(unsubscribeUrl) + `\n\n— Jason`, headers: listUnsubHeaders(unsubscribeUrl) };
}

export function lead2Email({ prospect, hasPlan, siteUrl, unsubscribeUrl }) {
  const subject = 'The one thing most AI projects get wrong';
  const body = `Hi,\n\nCircling back once, then I'll leave you be.\n\nMost AI and automation work ships on a demo and a prayer: it looks great in the meeting, then a real customer finds the one thing it gets wrong. The fix isn't more AI; it's proof: evals, tests, and a gate that catches the bad output before it ships. That's the whole reason my site runs its own quality checks in public.\n\nIf you've got something you're not 100% sure about, that's exactly the conversation to have. 15 minutes, no pitch:\n${siteUrl}/book.html\nOr scope it yourself: ${siteUrl}/build.html`;
  return { subject, text: body + footer(unsubscribeUrl) + `\n\n— Jason`, headers: listUnsubHeaders(unsubscribeUrl) };
}

export function unpaidEmail({ proposal, step, siteUrl, unsubscribeUrl }) {
  const link = `${siteUrl}/proposal.html?id=${proposal.public_id}`;
  const first = step === STEP.UNPAID_1;
  const subject = first ? 'Any questions on your proposal?' : 'Still here when you\'re ready';
  const body = first
    ? `Hi,\n\nI sent your proposal a few days ago. Any questions before you decide? Happy to jump on a quick call or answer over email.\n\nYour proposal: ${link}`
    : `Hi,\n\nStill holding your slot. If the timing is off, no pressure at all, just let me know and I'll set it aside.\n\nYour proposal: ${link}`;
  return { subject, text: body + footer(unsubscribeUrl) + `\n\n— Jason`, headers: listUnsubHeaders(unsubscribeUrl) };
}

export function expiringEmail({ proposal, siteUrl, unsubscribeUrl }) {
  const link = `${siteUrl}/proposal.html?id=${proposal.public_id}`;
  let dateStr = '';
  if (proposal.expires_at) {
    const d = new Date(proposal.expires_at);
    if (!Number.isNaN(d.getTime())) dateStr = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  const subject = 'Your proposal expires soon';
  const body = `Hi,\n\nQuick heads-up. Your proposal expires${dateStr ? ` on ${dateStr}` : ' soon'}. After that the scope and price may need a refresh.\n\nIf you want to move ahead, here it is: ${link}`;
  return { subject, text: body + footer(unsubscribeUrl) + `\n\n— Jason`, headers: listUnsubHeaders(unsubscribeUrl) };
}
