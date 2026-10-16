// base44/shared/access.ts
// Shared authorisation helpers so every backend function applies the same
// rules for staff access and auction ownership.

// Admins and auctioneers are platform staff.
export function isStaff(user) {
  return !!user && (user.role === 'admin' || user.role === 'auctioneer');
}

// Admins may operate any auction. An auctioneer may operate only an auction
// they are explicitly assigned to — an unassigned auction is admin-only, so an
// auctioneer can never close, bid on, or confirm payment for someone else's sale.
export function canOperateAuction(user, auction) {
  if (!user || !auction) return false;
  if (user.role === 'admin') return true;
  return user.role === 'auctioneer' && !!auction.auctioneer_id && auction.auctioneer_id === user.id;
}

// The account that owns a listing. Seller-listed garage sale items record the
// organiser as seller_id (they are created by the service role); admin-created
// listings fall back to created_by_id.
export function auctionOwnerId(auction) {
  return (auction && (auction.seller_id || auction.created_by_id)) || '';
}
