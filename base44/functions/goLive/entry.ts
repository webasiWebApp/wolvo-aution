import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Auctioneer/admin starts or stops a Go Live broadcast on an auction or a
// garage sale / house clearance event. Two sources are supported:
//   - 'embed': an external stream URL (YouTube/Facebook/Vimeo/custom) the
//     auctioneer pastes; viewers watch it embedded.
//   - 'camera': the auctioneer broadcasts from their device camera inside the
//     app; viewers connect peer-to-peer via the LiveRoom actor.
// Ownership is enforced server-side (auction: seller/creator/auctioneer; event:
// creator). Writes use the service role since Auction/GarageSaleEvent writes are
// admin-only under RLS. No secret material is returned.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in to go live.' }, { status: 401 });
    if (user.role !== 'auctioneer' && user.role !== 'admin') {
      return Response.json({ error: 'Only auctioneers can broadcast.' }, { status: 403 });
    }

    const body = await req.json();
    const { action, target_type, target_id, source, embed_url } = body || {};
    if (action !== 'start' && action !== 'stop') {
      return Response.json({ error: 'action must be start or stop.' }, { status: 400 });
    }
    if (!['auction', 'event'].includes(target_type) || !target_id) {
      return Response.json({ error: 'target_type and target_id are required.' }, { status: 400 });
    }

    // An embedded player URL must be a plain https link; anything else (for
    // example a javascript: URL) would run script inside viewers' pages.
    let embedUrl = '';
    if (action === 'start' && source !== 'camera') {
      try {
        const u = new URL(String(embed_url || ''));
        if (u.protocol !== 'https:') throw new Error('not https');
        embedUrl = u.toString();
      } catch (_) {
        return Response.json({ error: 'Enter a valid https:// stream URL.' }, { status: 400 });
      }
    }

    const svc = base44.asServiceRole;
    const entity = target_type === 'auction' ? svc.entities.Auction : svc.entities.GarageSaleEvent;
    const rec = await entity.get(target_id).catch(() => null);
    if (!rec) return Response.json({ error: target_type === 'auction' ? 'Auction not found.' : 'Event not found.' }, { status: 404 });
    const owns = user.role === 'admin' || rec.created_by_id === user.id ||
      (target_type === 'auction' && (rec.seller_id === user.id || rec.auctioneer_id === user.id));
    if (!owns) return Response.json({ error: `Not authorised to broadcast this ${target_type}.` }, { status: 403 });

    if (action === 'start') {
      const src = source === 'camera' ? 'camera' : 'embed';
      await entity.update(target_id, {
        live_now: true,
        live_source: src,
        live_stream_url: src === 'embed' ? embedUrl : '',
        live_started_at: new Date().toISOString()
      });
    } else {
      await entity.update(target_id, { live_now: false, live_source: '', live_stream_url: '' });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}