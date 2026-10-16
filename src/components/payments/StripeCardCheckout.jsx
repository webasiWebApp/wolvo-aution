import { useState, useEffect, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { invokeFunction } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, CreditCard, CheckCircle2, AlertTriangle, Lock, Clock } from 'lucide-react';

// Payment statuses that mean the order did NOT succeed and the buyer may retry.
const TERMINAL_FAIL = ['failed', 'canceled', 'expired'];

// The inner form lives inside <Elements> so it can use the Stripe hooks.
// submittedRef guarantees stripe.confirmPayment is invoked at most once per
// submit, preventing duplicate charges on double-clicks or fast re-enters.
function CheckoutForm({ amount, currency, returnUrl, onConfirmed }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submittedRef = useRef(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements || submitting || submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      // redirect:'if_required' keeps 3D Secure / SCA in-element when possible and
      // only redirects when the bank demands it. Wolvo never sees the card details.
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: returnUrl },
        redirect: 'if_required'
      });
      if (result.error) {
        setError(result.error.message || 'Your payment could not be processed. Please try a different card.');
        // Allow another attempt (the PaymentIntent stays reusable until it succeeds).
        submittedRef.current = false;
      } else {
        onConfirmed();
      }
    } catch (e) {
      setError(e.message || 'Payment could not be confirmed.');
      submittedRef.current = false;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <Button type="submit" disabled={!stripe || !elements || submitting} className="w-full">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4 mr-1" />}
        Pay ${(amount || 0).toLocaleString('en-AU')} {currency.toUpperCase()}
      </Button>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <Lock className="h-3 w-3" /> Card details are secured by Stripe. Wolvo never sees or stores your card number.
      </p>
    </form>
  );
}

export default function StripeCardCheckout({ tx, invalidate }) {
  const [intent, setIntent] = useState(null);
  const [stripePromise, setStripePromise] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  // phase: 'form' | 'confirming' | 'paid' | 'failed' | 'pending_review'
  const [phase, setPhase] = useState('form');
  const [failMsg, setFailMsg] = useState('');
  const pollStateRef = useRef({ timer: null, cancelled: false });

  // Request the PaymentIntent + publishable key from the backend.
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true); setErr(''); setPhase('form');
      try {
        const res = await invokeFunction('createStripePaymentIntent', { transaction_id: tx.id });
        if (!active) return;
        if (res.status >= 400) { setErr((res.data && res.data.error) || 'Could not start card payment.'); return; }
        const data = res.data;
        // Order already paid (e.g. refresh after success, or a 3D-Secure
        // redirect that already captured funds). Show success immediately —
        // no card form, no polling.
        if (data.already_paid) { setPhase('paid'); invalidate(); return; }
        setIntent(data);
        if (data.publishable_key) setStripePromise(loadStripe(data.publishable_key));
      } catch (e) { if (active) setErr(e.message || 'Could not start card payment.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [tx.id]);

  const stopPolling = () => {
    pollStateRef.current.cancelled = true;
    if (pollStateRef.current.timer) { clearTimeout(pollStateRef.current.timer); pollStateRef.current.timer = null; }
  };

  // After the browser confirms, poll the server until the webhook marks the
  // order paid — the frontend never marks the order paid on its own say-so.
  // Adaptive cadence: every 2s for the first 30s, then every 5s up to ~2 min.
  // Detects paid (success), failed/canceled/expired (retryable), or gives a
  // non-spinner "still confirming" state so the buyer is never stuck on a loop.
  const startPolling = () => {
    if (pollStateRef.current.timer || pollStateRef.current.cancelled) return;
    setPhase('confirming');
    pollStateRef.current = { timer: null, cancelled: false };
    const startedAt = Date.now();

    const tick = async () => {
      if (pollStateRef.current.cancelled) return;
      pollStateRef.current.timer = null;
      let done = false;
      try {
        const res = await invokeFunction('getPaymentCheckout', { transaction_id: tx.id });
        if (pollStateRef.current.cancelled) return;
        const status = res.data && res.data.order && res.data.order.status;
        if (status === 'paid') {
          setPhase('paid');
          invalidate();
          done = true;
        } else if (status && TERMINAL_FAIL.includes(status)) {
          setFailMsg((res.data && res.data.order && res.data.order.status_label) || status);
          setPhase('failed');
          done = true;
        }
      } catch (_) { /* transient — keep polling */ }
      if (done || pollStateRef.current.cancelled) return;
      const elapsed = Date.now() - startedAt;
      if (elapsed >= 120000) { setPhase('pending_review'); return; }
      pollStateRef.current.timer = setTimeout(tick, elapsed < 30000 ? 2000 : 5000);
    };

    pollStateRef.current.timer = setTimeout(tick, 0);
  };

  // Clean up any pending poll on unmount so we never setState after unmount.
  useEffect(() => () => { stopPolling(); }, []);

  if (loading) return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 mb-3 flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Preparing secure card payment…
    </div>
  );

  if (err) return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-3 text-sm text-red-700 flex items-start gap-2">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> <span>{err}</span>
    </div>
  );

  if (phase === 'paid') return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 mb-3 text-sm text-emerald-700 flex items-center gap-2">
      <CheckCircle2 className="h-4 w-4" /> Payment received. Your order is now paid.
    </div>
  );

  if (phase === 'failed') return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 mb-3 text-sm text-red-700">
      <div className="flex items-start gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Payment {failMsg ? `marked ${failMsg.toLowerCase()}` : 'could not be confirmed'}. You can try again — you have not been charged.</span>
      </div>
      <Button size="sm" variant="outline" onClick={() => { setFailMsg(''); setPhase('form'); }}>Try again</Button>
    </div>
  );

  if (phase === 'pending_review') return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-3 text-sm text-amber-800">
      <div className="flex items-start gap-2 mb-2">
        <Clock className="h-4 w-4 mt-0.5 shrink-0" />
        <span>We're still confirming your payment with your bank. It's safe to leave this page — we'll notify you once it's confirmed.</span>
      </div>
      <Button size="sm" variant="outline" onClick={startPolling}>Check status again</Button>
    </div>
  );

  if (phase === 'confirming') return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 mb-3 flex items-center gap-2 text-sm text-amber-700">
      <Loader2 className="h-4 w-4 animate-spin" />
      Confirming your payment with our system…
    </div>
  );

  if (!intent || !stripePromise) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <CreditCard className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">Pay by card</p>
        {intent.mode !== 'live' && <span className="ml-auto text-xs text-muted-foreground">Sandbox test mode</span>}
      </div>
      <div className="flex justify-between text-sm mb-3">
        <span className="text-muted-foreground">Amount due</span>
        <span className="font-bold">${(intent.amount || 0).toLocaleString('en-AU')} {intent.currency.toUpperCase()}</span>
      </div>
      <Elements stripe={stripePromise} options={{ clientSecret: intent.client_secret, appearance: { theme: 'stripe' } }}>
        <CheckoutForm
          amount={intent.amount}
          currency={intent.currency}
          returnUrl={`${window.location.origin}/transactions/${tx.id}`}
          onConfirmed={startPolling}
        />
      </Elements>
    </div>
  );
}