// Branded transactional email templates. One light, table-based, inline-styled shell
// (maximum client compatibility + deliverability) with a dark header bar and the brand
// green accent. Every builder returns { subject, text, html } so callers keep a plain-text
// fallback. Keep these transactional (no marketing, no List-Unsubscribe) — receipts,
// invoices, reset links, contracts, message nudges.
import { money } from '../assets/proposal-core.mjs';

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
