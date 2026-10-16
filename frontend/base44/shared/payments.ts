// Shared payment helpers used by every payment backend function.
// Manual methods (PayID, bank transfer) need no external provider. Online
// methods (Stripe, PayPal) require credentials + a verified webhook before
// they are advertised as active.

export const PAYMENT_METHODS = [
  { key: 'stripe', label: 'Credit / debit card (Stripe)', group: 'online' },
  { key: 'paypal', label: 'PayPal', group: 'online' },
  { key: 'payid', label: 'PayID', group: 'manual' },
  { key: 'bank_transfer', label: 'Bank transfer', group: 'manual' }
];

export const STATUS_LABEL = {
  awaiting_payment: 'Awaiting Payment',
  processing: 'Processing',
  paid: 'Paid',
  failed: 'Failed',
  expired: 'Expired',
  refund_pending: 'Refund Pending',
  partially_refunded: 'Partially Refunded',
  refunded: 'Refunded',
  canceled: 'Canceled'
};

// Methods confirmed by staff once funds arrive (no external provider).
export const MANUAL_METHODS = ['payid', 'bank_transfer', 'manual'];

// Payment states that already hold (or are returning) the buyer's money. A new
// charge, method change or failure mark must never overwrite one of these.
export const SETTLED_STATUSES = ['paid', 'processing', 'refund_pending', 'refunded', 'partially_refunded'];

// A short, human-friendly, hard-to-guess reference the buyer quotes with their
// payment (e.g. WOLVO-K7Q3PM9X). One per order.
export function generateReference(prefix) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  (globalThis.crypto || (typeof crypto !== 'undefined' ? crypto : null)).getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += alphabet[bytes[i] % alphabet.length];
  return `${prefix || 'WOLVO'}-${out}`;
}

export function defaultConfig() {
  return {
    config_name: 'default',
    stripe_enabled: false, stripe_mode: 'test',
    paypal_enabled: false, paypal_mode: 'sandbox',
    payid_enabled: false, payid_alias: '', payid_name: '', payid_instructions: '',
    bank_transfer_enabled: false, bank_name: '', bank_account_name: '', bank_bsb: '', bank_account_number: '', bank_instructions: '',
    default_payment_deadline_days: 3,
    live_payments_enabled: false
  };
}

export async function getConfig(base44) {
  const page = await base44.entities.PaymentMethodConfig.filter({ config_name: 'default' }, { limit: 1 });
  const cfg = (page.items || [])[0];
  return cfg ? { ...defaultConfig(), ...cfg } : defaultConfig();
}

export function methodEnabled(config, method) {
  if (method === 'stripe') return !!config.stripe_enabled;
  if (method === 'paypal') return !!config.paypal_enabled;
  if (method === 'payid') return !!config.payid_enabled;
  if (method === 'bank_transfer') return !!config.bank_transfer_enabled;
  return true;
}

// Pure, side-effect-free gate for Stripe card payments. Evaluated server-side
// from the authoritative PaymentMethodConfig and the stored secrets — never
// from client input. Returns { ok: true, mode } or { ok: false, error, status }.
// Safe to unit-test with mocked configs/keys: it never calls Stripe or the DB.
export function evaluateStripePaymentGate(config, secretKey, publishableKey) {
  if (!config || !config.stripe_enabled) {
    return { ok: false, error: 'Card payments are not available.', status: 400 };
  }
  const mode = config.stripe_mode === 'live' ? 'live' : 'test';
  // Live-mode charges require explicit admin opt-in. Test mode is never gated
  // by this flag, so test payments keep working with live disabled.
  if (mode === 'live' && !config.live_payments_enabled) {
    return { ok: false, error: 'Live card payments are not enabled.', status: 403 };
  }
  if (!secretKey || !publishableKey) {
    return { ok: false, error: 'Card payments are not configured.', status: 500 };
  }
  // Credential/mode consistency: test keys for test mode, live keys for live
  // mode, and the secret + publishable pair must agree. A generic error is
  // returned so no key material is exposed. This prevents test credentials
  // from creating live charges and live credentials running in test mode.
  // Secret keys may be standard (sk_) or restricted (rk_); both prefixes are valid.
  const secretMode = /^(sk|rk)_live_/.test(secretKey) ? 'live' : /^(sk|rk)_test_/.test(secretKey) ? 'test' : 'unknown';
  const pubMode = publishableKey.startsWith('pk_live_') ? 'live' : publishableKey.startsWith('pk_test_') ? 'test' : 'unknown';
  if (secretMode !== mode || pubMode !== mode || secretMode !== pubMode) {
    return { ok: false, error: 'Card payment configuration mismatch. Contact support.', status: 500 };
  }
  return { ok: true, mode };
}

// True if the user is the order's buyer or an admin. Pure; testable with mocks.
export function buyerOwnsOrder(tx, user) {
  return !!(user && tx && (tx.buyer_id === user.id || user.role === 'admin'));
}

// The payable amount, read ONLY from the trusted transaction record. Client
// input never participates. Pure; testable with mocks.
export function payableAmount(tx) {
  const amount = (tx && (tx.total || tx.final_price)) || 0;
  return amount > 0 ? amount : 0;
}

export async function auditPayment(base44, entry) {
  await base44.entities.AuditLog.create({
    actor_id: entry.actor_id || '',
    actor_email: entry.actor_email || '',
    action: entry.action || 'payment_event',
    entity_type: 'Payment',
    entity_id: entry.payment_id || '',
    details: entry.details || '',
    severity: entry.severity || 'info'
  });
}

// Marks a Payment (and its CompletedTransaction) paid after Stripe confirms a
// PaymentIntent. Idempotent: a payment already paid/refunded is never touched.
// `base44` must be the service-role client. Shared by the Stripe webhook
// (event-driven) and the checkout poll (pull-driven fallback) so an order
// finalises even when webhook delivery is delayed or mis-routed.
export async function markStripePaid(base44, payment, pi) {
  if (!payment) return 'no_payment';
  if (['paid', 'refunded', 'partially_refunded'].includes(payment.status)) return 'already_paid';
  const now = new Date().toISOString();
  await base44.entities.Payment.update(payment.id, {
    status: 'paid',
    paid_at: now,
    provider: 'stripe',
    provider_reference: pi.id,
    failure_reason: ''
  });
  let tx = null;
  if (payment.transaction_id) {
    tx = await base44.entities.CompletedTransaction.get(payment.transaction_id).catch(() => null);
    if (tx && tx.status === 'pending_payment') {
      await base44.entities.CompletedTransaction.update(tx.id, {
        status: 'paid',
        payment_method: 'stripe',
        payment_reference: payment.payment_reference
      });
    }
  }
  await auditPayment(base44, {
    payment_id: payment.id,
    action: 'stripe_payment_succeeded',
    details: `Stripe PaymentIntent ${pi.id} succeeded for $${payment.amount}.`,
    severity: 'info'
  });
  const recipients = new Set();
  if (payment.user_id) recipients.add(payment.user_id);
  if (tx && tx.seller_id) recipients.add(tx.seller_id);
  for (const uid of recipients) {
    await base44.entities.Notification.create({
      user_id: uid,
      type: 'payment_event',
      title: 'Payment received',
      body: `Your card payment of $${payment.amount} has been received. Reference ${payment.payment_reference}.`,
      link: tx ? `/transactions/${tx.id}` : null
    }).catch(() => {});
  }
  return 'marked_paid';
}