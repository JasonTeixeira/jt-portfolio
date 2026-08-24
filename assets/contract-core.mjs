import { publicId, money } from './proposal-core.mjs';
import { computePlan, CARD_BY_KEY } from './scope-core.mjs';

export const CONTRACT_TERMS_VERSION = '2026-08-23';
export const CONTRACT_CAVEAT = 'This is a drafting template generated from your proposal, not executed legal advice. Both parties should have it reviewed by counsel before signing.';
export { publicId, money };

// Deliverables derived from the catalog items the client scoped.
function deliverablesFromKeys(keys) {
  const plan = computePlan(Array.isArray(keys) ? keys : [], null);
  return plan.items.map((i) => ({ name: i.name, why: i.why }));
}

// Statement of Work, filled from the proposal. No invented figures — all passed in.
export function buildSow({ clientName, projectName, keys, firmCents, depositCents, balanceCents, nowIso }) {
  const items = deliverablesFromKeys(keys);
  const dList = items.length ? items.map((i) => `• ${i.name} — ${i.why}`).join('\n') : '• Scope as discussed and quoted.';
  return {
    kind: 'sow',
    sections: [
      { heading: 'Statement of Work', body: `This Statement of Work is between Sage Ideas LLC ("Consultant") and ${clientName || '[CLIENT]'} ("Client") for the project "${projectName || 'Engagement'}", dated ${nowIso.slice(0, 10)}.` },
      { heading: 'Scope & Deliverables', body: dList },
      { heading: 'Out of scope', body: 'Anything not listed above is not included and is quoted separately before any such work begins.' },
      { heading: 'Fees', body: `Total: ${money(firmCents)}. Deposit: ${money(depositCents)} (credited to the total, due before work begins). Balance: ${money(balanceCents)}, invoiced on delivery.` },
      { heading: 'Revisions', body: 'Two rounds of revisions per deliverable are included. Further rounds are billed at an hourly rate agreed in advance.' },
      { heading: 'Timeline', body: 'Work begins once the deposit clears. The timeline is a working estimate and moves with the speed of feedback and access to systems.' },
      { heading: 'Ownership', body: 'The delivered work transfers to Client on full payment of the balance. Until then, ownership stays with Consultant.' },
      { heading: 'Acceptance', body: 'Client has five business days after delivery of each milestone to accept or send specific written change requests; no response within that period means the milestone is accepted.' },
    ],
    meta: { clientName: clientName || null, firmCents, depositCents, balanceCents },
  };
}

// Master Services Agreement — the umbrella terms (client name filled).
export function buildMsa({ clientName, nowIso }) {
  return {
    kind: 'msa',
    sections: [
      { heading: 'Master Services Agreement', body: `This Agreement is between Sage Ideas LLC ("Consultant") and ${clientName || '[CLIENT]'} ("Client"), effective ${nowIso.slice(0, 10)}. It governs all Statements of Work between the parties.` },
      { heading: 'Independent contractor', body: 'Consultant is an independent contractor, responsible for its own taxes, insurance, and equipment. Nothing here creates an employment, partnership, or exclusive relationship.' },
      { heading: 'Confidentiality', body: 'Each party will use the other’s non-public information only to perform or receive the services, protect it with reasonable care, and not disclose it except to people bound by similar obligations. Obligations survive termination.' },
      { heading: 'Intellectual property', body: 'Deliverables created for Client transfer to Client on full payment. Consultant retains its pre-existing tools, frameworks, and general methods, and grants Client a license to use any that are embedded in a deliverable.' },
      { heading: 'Warranties', body: 'Consultant will perform in a professional and workmanlike manner. Except as stated, services and deliverables are provided as is; the results of any AI system are probabilistic by nature.' },
      { heading: 'Limitation of liability', body: 'Neither party is liable for indirect or consequential damages. Each party’s total liability under a Statement of Work will not exceed the fees paid under that Statement of Work.' },
      { heading: 'Term & termination', body: 'Either party may terminate for convenience on fifteen days’ written notice, or immediately for uncured material breach. On termination, Client pays for work performed through that date.' },
      { heading: 'Governing law', body: 'This Agreement is governed by the laws of the State of Illinois.' },
    ],
    meta: { clientName: clientName || null },
  };
}
