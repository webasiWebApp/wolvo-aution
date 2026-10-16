import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { settleAuction } from '../../shared/settleAuction.ts';

// Scheduled maintenance: closes every open auction whose closing_time has
// passed, settling each via the shared settleAuction logic (creates the
// winner's CompletedTransaction when there is a winning bid that meets the
// reserve). Runs as the service role so it works from the scheduler with no
// user. A direct HTTP call by a signed-in non-admin is rejected; admins may
// invoke it manually. Idempotent — settleAuction skips any auction that is not
// open, so re-runs and overlap with a manual close are safe.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    // Block direct non-admin invocation; allow the scheduler (no user) + admins.
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin') return Response.json({ error: 'Admin only.' }, { status: 403 });
    } catch (_) { /* no user context — scheduled run */ }

    const page = await base44.asServiceRole.entities.Auction.filter(
      { status: 'open', closing_time: { $lte: new Date().toISOString() } },
      { sort: 'closing_time', limit: 200 }
    );
    const expired = page.items || [];
    const results = [];
    for (const a of expired) {
      const r = await settleAuction(base44.asServiceRole, a.id, { id: 'system', email: 'auto-close@wolvo' })
        .catch((e) => ({ ok: false, error: e.message }));
      results.push({
        auction_id: a.id,
        title: a.title,
        ok: !!r.ok,
        transaction_id: r.transaction_id || null,
        closed_reason: r.closed_reason || (r.ok ? '' : (r.error || ''))
      });
    }
    return Response.json({
      processed: expired.length,
      closed: results.filter((r) => r.ok).length,
      skipped: results.filter((r) => !r.ok).length,
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}