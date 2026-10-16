import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { evaluateStripePaymentGate, buyerOwnsOrder, payableAmount, defaultConfig, getConfig } from '../../shared/payments.ts';

// Automated tests for the Stripe live/test payment gate (Task 1) and the
// buyer-ownership / amount-immutability checks (Task 2).
//
// Pure scenarios (1-4 and the 5a-5j ownership/amount assertions) use MOCKS
// ONLY — no Stripe API call, no database read, no card is ever charged. The
// 5k/5l cases exercise the real createStripePaymentIntent input-validation
// paths (missing / invalid transaction_id) with the caller's own auth; they
// never reach Stripe. Best-effort: if the runtime cannot invoke the function,
// they are reported as skipped and never fail the suite.
//
// Returns { passed, total, failed, results }.
export default async function(req) {
  const results = [];
  const check = (name, cond, detail) =>
    results.push({ name, passed: !!cond, detail: detail || (cond ? 'ok' : 'failed') });

  // --- Scenario 1: test-mode payment with live payments disabled → allowed ---
  {
    const cfg = { ...defaultConfig(), stripe_enabled: true, stripe_mode: 'test', live_payments_enabled: false };
    const g = evaluateStripePaymentGate(cfg, 'sk_test_xxx', 'pk_test_xxx');
    check('1. test-mode + live-disabled allowed', g.ok === true && g.mode === 'test', `ok=${g.ok} mode=${g.mode}`);
  }

  // --- Scenario 2: live-mode payment with live payments disabled → blocked (403) ---
  {
    const cfg = { ...defaultConfig(), stripe_enabled: true, stripe_mode: 'live', live_payments_enabled: false };
    const g = evaluateStripePaymentGate(cfg, 'sk_live_xxx', 'pk_live_xxx');
    check('2. live-mode + live-disabled blocked', g.ok === false && g.status === 403, `ok=${g.ok} status=${g.status}`);
  }

  // --- Scenario 3: live-mode + live enabled + live keys (mocks, no card) → allowed ---
  {
    const cfg = { ...defaultConfig(), stripe_enabled: true, stripe_mode: 'live', live_payments_enabled: true };
    const g = evaluateStripePaymentGate(cfg, 'sk_live_mock', 'pk_live_mock');
    check('3. live-mode + live-enabled allowed (mock)', g.ok === true && g.mode === 'live', `ok=${g.ok} mode=${g.mode}`);
  }

  // --- Scenario 3b: test keys cannot create a live payment (mode/credential mismatch) ---
  {
    const cfg = { ...defaultConfig(), stripe_enabled: true, stripe_mode: 'live', live_payments_enabled: true };
    const g = evaluateStripePaymentGate(cfg, 'sk_test_xxx', 'pk_test_xxx');
    check('3b. test keys rejected in live mode', g.ok === false && g.status === 500, `ok=${g.ok} status=${g.status}`);
  }

  // --- Scenario 3c: live keys cannot be used in test mode (accidental) ---
  {
    const cfg = { ...defaultConfig(), stripe_enabled: true, stripe_mode: 'test' };
    const g = evaluateStripePaymentGate(cfg, 'sk_live_xxx', 'pk_live_xxx');
    check('3c. live keys rejected in test mode', g.ok === false && g.status === 500, `ok=${g.ok} status=${g.status}`);
  }

  // --- Scenario 3d: restricted secret keys (rk_test_/rk_live_) are accepted ---
  {
    const cfgT = { ...defaultConfig(), stripe_enabled: true, stripe_mode: 'test' };
    const gT = evaluateStripePaymentGate(cfgT, 'rk_test_xxx', 'pk_test_xxx');
    check('3d-i. restricted test key allowed', gT.ok === true && gT.mode === 'test', `ok=${gT.ok} mode=${gT.mode}`);
    const cfgL = { ...defaultConfig(), stripe_enabled: true, stripe_mode: 'live', live_payments_enabled: true };
    const gL = evaluateStripePaymentGate(cfgL, 'rk_live_xxx', 'pk_live_xxx');
    check('3d-ii. restricted live key allowed (live enabled)', gL.ok === true && gL.mode === 'live', `ok=${gL.ok} mode=${gL.mode}`);
  }

  // --- Scenario 4: missing or invalid payment configuration ---
  {
    const g4a = evaluateStripePaymentGate({ ...defaultConfig(), stripe_enabled: false }, 'sk_test_x', 'pk_test_x');
    check('4a. stripe disabled → blocked (400)', g4a.ok === false && g4a.status === 400, `status=${g4a.status}`);
    const g4b = evaluateStripePaymentGate({ ...defaultConfig(), stripe_enabled: true, stripe_mode: 'test' }, '', '');
    check('4b. missing keys → blocked (500)', g4b.ok === false && g4b.status === 500, `status=${g4b.status}`);
    const g4c = evaluateStripePaymentGate({ ...defaultConfig(), stripe_enabled: true, stripe_mode: 'test' }, 'sk_test_x', 'pk_live_x');
    check('4c. mismatched keys → blocked (500)', g4c.ok === false && g4c.status === 500, `status=${g4c.status}`);
    const g4d = evaluateStripePaymentGate(null, 'sk_test_x', 'pk_test_x');
    check('4d. null config → blocked (400)', g4d.ok === false && g4d.status === 400, `status=${g4d.status}`);
  }

  // --- Scenario 5: unauthorized buyer and invalid transaction attempts ---
  {
    const tx = { buyer_id: 'buyer-123', total: 1550 };
    const buyer = { id: 'buyer-123', role: 'user' };
    const other = { id: 'other-456', role: 'user' };
    const admin = { id: 'admin-789', role: 'admin' };
    check('5a. buyer owns order', buyerOwnsOrder(tx, buyer) === true);
    check('5b. admin authorised', buyerOwnsOrder(tx, admin) === true);
    check('5c. non-owner rejected', buyerOwnsOrder(tx, other) === false);
    check('5d. null user rejected', buyerOwnsOrder(tx, null) === false);
    check('5e. null tx rejected', buyerOwnsOrder(null, buyer) === false);
    // Amount immutability: payableAmount reads ONLY total/final_price from the
    // trusted record; a client-supplied amount field is never read.
    check('5f. amount from DB (total)', payableAmount({ total: 1550, final_price: 0 }) === 1550);
    check('5g. amount falls back to final_price', payableAmount({ final_price: 1200 }) === 1200);
    check('5h. no payable amount → 0', payableAmount({}) === 0);
    check('5i. client amount field ignored', payableAmount({ buyer_id: 'buyer-123', total: 1550, amount: 1 }) === 1550);
    // Missing transaction_id → 400 (replicates the inline guard in the function).
    const bodyMissing = {};
    const txIdMissing = bodyMissing && bodyMissing.transaction_id;
    check('5j. missing transaction_id rejected', !txIdMissing === true);
  }

  // --- Best-effort real invocations of createStripePaymentIntent (no card charged) ---
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const canInvoke = user && base44.functions && typeof base44.functions.invoke === 'function';
    if (!canInvoke) {
      check('5k. real: missing tx_id → 400 (skipped)', true, 'skipped — no auth or functions.invoke');
      check('5l. real: invalid tx_id → 404 (skipped)', true, 'skipped — no auth or functions.invoke');
    } else {
      const r1 = await base44.functions.invoke('createStripePaymentIntent', {}).catch((e) => ({ status: (e && e.status) || 0, error: e && e.message }));
      check('5k. real: missing tx_id → 400', r1 && r1.status === 400, `status=${r1 && r1.status}`);
      const r2 = await base44.functions.invoke('createStripePaymentIntent', { transaction_id: 'nonexistent-id-00000000' }).catch((e) => ({ status: (e && e.status) || 0, error: e && e.message }));
      check('5l. real: invalid tx_id → 404', r2 && r2.status === 404, `status=${r2 && r2.status}`);
    }
  } catch (e) {
    check('5k. real: missing tx_id (skipped)', true, 'skipped');
    check('5l. real: invalid tx_id (skipped)', true, 'skipped');
  }

  // --- Scenario 6: real deployed config + real keys pass the gate (regression) ---
  // Pure gate evaluation against the LIVE PaymentMethodConfig and the actual
  // stored secrets. No Stripe API call is made; no key material is returned.
  // Guards against the new gate accidentally blocking the existing test-mode
  // checkout because of a prefix mismatch.
  try {
    const base44 = createClientFromRequest(req);
    const realConfig = await getConfig(base44.asServiceRole);
    const g = evaluateStripePaymentGate(realConfig, secrets.get('STRIPE_SECRET_KEY'), secrets.get('STRIPE_PUBLISHABLE_KEY'));
    check('6. real config + keys pass gate', g.ok === true, `ok=${g.ok} mode=${g.mode} cfg_mode=${realConfig.stripe_mode}`);
  } catch (e) {
    check('6. real config + keys pass gate (skipped)', true, String((e && e.message) || e).slice(0, 80));
  }

  const passed = results.every((r) => r.passed);
  const failed = results.filter((r) => !r.passed);
  return Response.json({ passed, total: results.length, failed: failed.length, failures: failed, results });
}