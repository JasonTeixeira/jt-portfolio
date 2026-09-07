const SECRET = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
let _stripe = null;
export function isEnabled() { return Boolean(SECRET); }
// A checkout is only safe to start if we can also RECEIVE its webhook — otherwise a real
// payment could succeed while the app never records it (and the client could be asked to pay again).
export function webhookConfigured() { return Boolean(process.env.STRIPE_WEBHOOK_SECRET); }
async function stripe() {
  if (!isEnabled()) return null;
  if (!_stripe) { const { default: Stripe } = await import('stripe'); _stripe = new Stripe(SECRET); }
  return _stripe;
}
export async function createCheckoutSession({ amountCents, currency = 'usd', productName = 'Project deposit',
  publicId, proposalId, customerEmail, successUrl, cancelUrl, kind = 'deposit' }) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try {
    const s = await stripe();
    const meta = { proposalId, publicId, kind };
    const session = await s.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ quantity: 1, price_data: { currency,
        product_data: { name: productName }, unit_amount: amountCents } }],
      customer_email: customerEmail || undefined,
      success_url: successUrl, cancel_url: cancelUrl,
      metadata: meta,
      payment_intent_data: { metadata: meta },
    });
    return { ok: true, url: session.url, id: session.id };
  } catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
export async function retrieveSession(id) {
  if (!isEnabled()) return { ok: false, skipped: true };
  try { const s = await stripe(); return { ok: true, session: await s.checkout.sessions.retrieve(id) }; }
  catch (e) { return { ok: false, error: String((e && e.message) || e) }; }
}
// Throws on invalid signature (caller maps to 400). Returns null-marker when secret unset.
export async function constructEvent(rawBody, signature) {
  if (!WEBHOOK_SECRET) return { skipped: true };
  const s = await stripe();
  if (!s) return { skipped: true };
  return { event: s.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET) };
}
