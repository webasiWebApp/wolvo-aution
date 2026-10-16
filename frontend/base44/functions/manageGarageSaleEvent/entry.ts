import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

// Manages a Garage Sale / House Clearance event and the individual item auctions
// inside it. The event is a parent container; each item is a normal Auction that
// reuses the existing bidding, closing, verification, payment and transaction
// systems — there is NO separate bidding or payment system here.
//
// The organiser is any signed-in user. The event is created with the user's own
// client (so created_by_id = the organiser). Items are created with the service
// role because Auction.create is admin-only by design; the organiser is recorded
// on each item as seller_id, and settleAuction pays seller_id. This preserves
// the existing admin-only Auction.create RLS — sellers never get raw create
// permission, only this validated path.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Sign in to manage a garage sale.' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const action = body && body.action;

    if (action === 'create_event') {
      const title = (body.title || '').trim();
      if (!title) return Response.json({ error: 'A title is required.' }, { status: 400 });
      const ev = await base44.entities.GarageSaleEvent.create({
        title,
        description: body.description || '',
        images: Array.isArray(body.images) ? body.images : [],
        participation: ['online', 'physical', 'hybrid'].includes(body.participation) ? body.participation : 'online',
        venue_name: body.venue_name || '',
        address: body.address || '',
        suburb: body.suburb || '',
        state: body.state || '',
        inspection_notes: body.inspection_notes || '',
        inspection_times: Array.isArray(body.inspection_times) ? body.inspection_times : [],
        event_start: body.event_start || '',
        event_end: body.event_end || '',
        collection_instructions: body.collection_instructions || '',
        status: 'open',
        organizer_id: user.id
      });
      return Response.json({ event: ev });
    }

    // All other actions operate on a specific event and require organiser ownership.
    const eventId = body.event_id;
    const event = eventId ? await base44.asServiceRole.entities.GarageSaleEvent.get(eventId).catch(() => null) : null;
    if (!event) return Response.json({ error: 'Event not found.' }, { status: 404 });
    const isOwner = event.created_by_id === user.id || user.role === 'admin';
    if (!isOwner) return Response.json({ error: 'Only the organiser can manage this event.' }, { status: 403 });

    if (action === 'update_event') {
      const upd = {};
      // Live-stream fields are controlled only by goLive (auctioneer-only).
      for (const k of ['title', 'description', 'participation', 'venue_name', 'address', 'suburb', 'state', 'inspection_notes', 'collection_instructions', 'event_start', 'event_end']) {
        if (body[k] !== undefined) upd[k] = body[k];
      }
      if (body.status !== undefined) {
        if (!['draft', 'open', 'closed', 'cancelled'].includes(body.status)) return Response.json({ error: 'Invalid event status.' }, { status: 400 });
        upd.status = body.status;
      }
      if (Array.isArray(body.images)) upd.images = body.images;
      if (Array.isArray(body.inspection_times)) upd.inspection_times = body.inspection_times;
      const ev = await base44.asServiceRole.entities.GarageSaleEvent.update(eventId, upd);
      return Response.json({ event: ev });
    }

    if (action === 'add_item') {
      const title = (body.title || '').trim();
      const startingBid = Number(body.starting_bid);
      const closingTime = body.closing_time;
      if (!title) return Response.json({ error: 'Item title is required.' }, { status: 400 });
      if (!Number.isFinite(startingBid) || startingBid < 0) return Response.json({ error: 'A valid starting bid is required.' }, { status: 400 });
      if (!closingTime) return Response.json({ error: 'A closing time is required.' }, { status: 400 });
      const now = Date.now();
      const startTime = body.start_time ? new Date(body.start_time).getTime() : now;
      const status = startTime > now ? 'upcoming' : 'open';
      const biddingType = ['online', 'physical', 'hybrid'].includes(body.bidding_type) ? body.bidding_type : (event.participation === 'online' ? 'online' : 'hybrid');
      const auction = await base44.asServiceRole.entities.Auction.create({
        title,
        description: body.description || '',
        category: body.category || 'Garage Sale',
        condition: body.condition || 'Used - Good',
        suburb: body.suburb || event.suburb || '',
        state: body.state || event.state || '',
        starting_bid: startingBid,
        min_bid_increment: Number(body.min_bid_increment) || 10,
        reserve_price: Number(body.reserve_price) || 0,
        status,
        bidding_type: biddingType,
        online_bidding_enabled: biddingType !== 'physical',
        start_time: body.start_time || new Date(now).toISOString(),
        closing_time: closingTime,
        image_url: body.image_url || (Array.isArray(body.images) ? body.images[0] : ''),
        images: Array.isArray(body.images) ? body.images : [],
        inspections_available: !!body.inspections_available,
        viewing_notes: body.viewing_notes || '',
        is_sample: false,
        seller_id: user.id,
        garage_sale_event_id: eventId
      });
      return Response.json({ auction });
    }

    if (action === 'update_item') {
      const auctionId = body.auction_id;
      if (!auctionId) return Response.json({ error: 'auction_id is required.' }, { status: 400 });
      const auction = await base44.asServiceRole.entities.Auction.get(auctionId).catch(() => null);
      if (!auction) return Response.json({ error: 'Item not found.' }, { status: 404 });
      if (auction.seller_id !== user.id && user.role !== 'admin') return Response.json({ error: 'Only the seller can edit this item.' }, { status: 403 });
      if (auction.status === 'closed') return Response.json({ error: 'A closed auction cannot be edited.' }, { status: 400 });
      const upd = {};
      for (const k of ['title', 'description', 'category', 'condition', 'suburb', 'state', 'image_url', 'images', 'inspections_available', 'viewing_notes']) {
        if (body[k] !== undefined) upd[k] = body[k];
      }
      // Pricing, format and timing are fair-play terms: once bidding has started
      // they are locked so bidders are never surprised by a moved reserve or an
      // earlier close. Closing happens only through settlement, never a status edit.
      const termFields = ['starting_bid', 'min_bid_increment', 'reserve_price', 'bidding_type', 'closing_time'];
      const changedTerms = termFields.filter((k) => body[k] !== undefined);
      if (changedTerms.length && (auction.bid_count || 0) > 0) {
        return Response.json({ error: `These terms cannot change after bidding has started: ${changedTerms.join(', ')}.` }, { status: 400 });
      }
      for (const k of changedTerms) upd[k] = body[k];
      if (body.status !== undefined) {
        if (!['upcoming', 'open'].includes(body.status)) return Response.json({ error: 'Item status can only be set to upcoming or open.' }, { status: 400 });
        upd.status = body.status;
      }
      const a = await base44.asServiceRole.entities.Auction.update(auctionId, upd);
      return Response.json({ auction: a });
    }

    return Response.json({ error: 'Unknown action.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}