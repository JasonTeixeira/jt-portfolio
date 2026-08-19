// Pure nurture rules + email templates. Shared browser+node. No I/O.
export const DUE = { LEAD_HOURS: 48, UNPAID_1_DAYS: 3, UNPAID_2_DAYS: 8, EXPIRING_WITHIN_DAYS: 3, DRAFT_STALE_HOURS: 24 };
export const SEND_CAP = 200;
export const STEP = { LEAD: 'lead_no_proposal', UNPAID_1: 'proposal_unpaid_1', UNPAID_2: 'proposal_unpaid_2', EXPIRING: 'proposal_expiring' };

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
  if (ageDays >= DUE.UNPAID_2_DAYS && !sent.has(STEP.UNPAID_2)) return STEP.UNPAID_2;
  if (ageDays >= DUE.UNPAID_1_DAYS && !sent.has(STEP.UNPAID_1)) return STEP.UNPAID_1;
  return null;
}

export function listUnsubHeaders(unsubscribeUrl) {
  return { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' };
}
function footer(unsubscribeUrl) { return `\n\nNot interested in these? Unsubscribe: ${unsubscribeUrl}`; }

export function leadEmail({ prospect, hasPlan, siteUrl, unsubscribeUrl }) {
  const subject = hasPlan ? 'Want me to turn your plan into a firm quote?' : 'Want me to map out what a build would look like?';
  const body = hasPlan
    ? `Hi,\n\nYou put together a plan on my site a couple of days back. Want me to turn it into a firm scope and price? It takes me a few minutes, and you get a real number to work with.\n\nStart here: ${siteUrl}/build.html\nOr if it's easier, book a short call: ${siteUrl}/book.html`
    : `Hi,\n\nYou grabbed something from my site recently. If you have a project in mind, I can map out what it would take and what it would cost, with no obligation.\n\nScope it here: ${siteUrl}/build.html\nOr book a short call: ${siteUrl}/book.html`;
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
