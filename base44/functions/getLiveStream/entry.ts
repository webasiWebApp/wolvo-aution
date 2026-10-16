import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Public lookup of the current Go Live state for an auction or garage sale
// event. Returns whether it is live, the source (embed/camera), the embed URL
// (for embed source), and the realtime room id (for camera source, so the
// viewer's CameraViewer can connect to the LiveRoom actor). No viewer personal
// data is returned. Used by the LiveStreamPanel which polls this to detect
// start/stop.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { target_type, target_id } = body || {};
    if (!['auction', 'event'].includes(target_type) || !target_id) {
      return Response.json({ error: 'target_type and target_id are required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const rec = target_type === 'auction'
      ? await svc.entities.Auction.get(target_id).catch(() => null)
      : await svc.entities.GarageSaleEvent.get(target_id).catch(() => null);
    if (!rec) return Response.json({ error: 'Not found' }, { status: 404 });

    return Response.json({
      live: !!rec.live_now,
      source: rec.live_source || '',
      embed_url: rec.live_stream_url || '',
      started_at: rec.live_started_at || '',
      room_id: `live_${target_type}_${target_id}`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}