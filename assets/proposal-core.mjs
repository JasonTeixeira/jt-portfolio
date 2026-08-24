// Pure, deterministic core for proposals. Shared by browser + node. No I/O.
export const DEPOSIT_PCT_DEFAULT = 0.30;
export const PROPOSAL_STATUS = {
  DRAFT: 'draft_pending', APPROVED: 'approved', PAID: 'deposit_paid',
  EXPIRED: 'expired', DECLINED: 'declined',
};
export const TERMS_VERSION = '2026-08-19';
export const TERMS = [
  { heading: 'What this covers', body: 'The deliverables itemized above, built to the scope shown. Anything listed there is included at the price shown.' },
  { heading: 'Out of scope', body: 'Work not itemized above is not included. New requests are quoted separately before any work starts, so there are no surprise charges.' },
  { heading: 'Revisions', body: 'Two rounds of revisions are included per deliverable. Further rounds are billed at an hourly rate agreed up front.' },
  { heading: 'Timeline', body: 'Work begins once the deposit clears. The timeline shown is a working estimate and moves with the speed of your feedback and access to systems.' },
  { heading: 'Payment', body: 'The deposit reserves the work and is credited to the total. The remaining balance is invoiced on delivery. The deposit is refundable until work begins, and non-refundable once it has.' },
  { heading: 'Ownership', body: 'You own the delivered work outright once the final balance is paid. Until then, ownership stays with Jason Teixeira / Sage Ideas LLC.' },
  { heading: 'Cancellation', body: 'You can stop the project at any time. You are billed for work completed to that point, and the deposit covers the first stage.' },
  { heading: 'Taxes', body: 'Prices exclude any applicable sales tax, VAT, or withholding. You are responsible for taxes owed in your jurisdiction.' },
  { heading: 'Validity', body: 'This proposal is valid until the expiry date shown. After that the scope and price may need a quick refresh.' },
];

export function firmCentsFromBand(band) {
  const lo = Number(band?.[0]) || 0, hi = Number(band?.[1]) || 0;
  return Math.round((lo + hi) / 2) * 100;
}
export function depositCents(firmCents, pct) { return Math.round(firmCents * pct); }
export function balanceCents(firmCents, depCents) { return firmCents - depCents; }
export function clampFirmCents(cents, band) {
  const lo = Number(band?.[0]) || 0, hi = Number(band?.[1]) || 0;
  const floor = Math.max(5000, Math.round(lo * 100 * 0.5)); // >= $50, or half the low band
  const ceil = Math.max(floor, Math.round(hi * 100 * 2));   // <= 2x the high band
  let out = Math.round(Number(cents) || 0), clamped = false;
  if (out < floor) { out = floor; clamped = true; }
  else if (out > ceil) { out = ceil; clamped = true; }
  return { cents: out, clamped };
}
const B62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
// 22 base62 chars ~= 131 bits. Rejection sampling (reject bytes >= 248 = 4*62) keeps the
// `% 62` map uniform — a naive modulo would bias low code points ever so slightly.
export function publicId() {
  const out = [];
  while (out.length < 22) {
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    for (const b of bytes) { if (b < 248) { out.push(B62[b % 62]); if (out.length === 22) break; } }
  }
  return out.join('');
}
export function money(cents, currency = 'usd') {
  const n = Math.round(Number(cents) || 0) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}
export function isExpired(row, nowIso) {
  if (!row || !row.expires_at) return false;
  return new Date(row.expires_at).getTime() < new Date(nowIso).getTime();
}
