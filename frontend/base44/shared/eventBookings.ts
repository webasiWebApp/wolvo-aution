// base44/shared/eventBookings.ts
// Shared helpers for product inspection viewings and physical-auction
// attendance registration. Imported by the inspection/attendance backend
// functions. Booking codes, in-app notifications, and the attendance
// threshold state machine live here so every function agrees on the rules.

import { auctionOwnerId } from './access.ts';

// Short, human-readable booking code (e.g. WV-A1B2C3 / AT-9X8Y7Z).
export function generateCode(prefix) {
  const raw = (crypto.randomUUID() || '').replace(/-/g, '');
  return `${prefix}-${raw.slice(0, 6).toUpperCase()}`;
}

// Best-effort in-app notification. Always uses the service-role client so the
// system/admin context can write to any user's notification feed.
export async function notifyUser(base44, userId, { type, title, body, link }) {
  if (!userId) return;
  try {
    await base44.entities.Notification.create({
      user_id: userId,
      type: type || 'general',
      title: title || 'Notification',
      body: body || '',
      link: link || ''
    });
  } catch (e) {
    // notifications are best-effort and must never break the primary operation
  }
}

// Number of CONFIRMED attendance registrations for an auction. Only confirmed
// registrations count towards the minimum attendance threshold — an expression
// of interest (status 'registered') never satisfies the minimum.
export async function countConfirmedAttendance(base44, auctionId) {
  const c = await base44.entities.AttendanceRegistration.count({ auction_id: auctionId, status: 'confirmed' });
  return c || 0;
}

// Recompute the auction's attendance_status from the current confirmed count
// and the registration deadline. This only performs the AUTOMATIC transitions:
//   REGISTRATION_OPEN -> MINIMUM_ATTENDANCE_REACHED  (threshold met)
//   REGISTRATION_OPEN -> AWAITING_MINIMUM_ATTENDANCE  (deadline passed, threshold unmet)
// Seller decisions (confirm / reschedule / cancel / complete) are made through
// manageAuctionEvent and are never overridden here. The seller is notified on
// each automatic transition; attendees are notified by manageAuctionEvent.
export async function recomputeAttendanceStatus(base44, auctionId) {
  const auction = await base44.entities.Auction.get(auctionId);
  if (!auction) return null;
  if (auction.bidding_type === 'online') return auction.attendance_status || null;

  const current = auction.attendance_status || 'REGISTRATION_OPEN';
  const terminal = ['AUCTION_CONFIRMED', 'AUCTION_RESCHEDULED', 'AUCTION_CANCELLED', 'AUCTION_COMPLETED'];
  if (terminal.includes(current)) return current;

  const confirmed = await countConfirmedAttendance(base44, auctionId);
  const minRequired = auction.min_confirmed_attendees || 0;
  const regClose = auction.registration_close_time || auction.registration_deadline;
  const now = Date.now();
  const closed = regClose && new Date(regClose).getTime() < now;

  let next = current;
  let note = null;

  if (minRequired > 0 && confirmed >= minRequired && current !== 'MINIMUM_ATTENDANCE_REACHED') {
    next = 'MINIMUM_ATTENDANCE_REACHED';
    note = {
      type: 'attendance_threshold_reached',
      title: 'Minimum attendance reached',
      body: `${confirmed} confirmed attendee(s) — the minimum of ${minRequired} for "${auction.title}" has been reached. Confirm the event in the auctioneer console to proceed.`
    };
  } else if (closed && confirmed < minRequired && current === 'REGISTRATION_OPEN') {
    next = 'AWAITING_MINIMUM_ATTENDANCE';
    note = {
      type: 'attendance_threshold_missed',
      title: 'Minimum attendance not reached',
      body: `Registration closed with ${confirmed} confirmed attendee(s); the minimum of ${minRequired} for "${auction.title}" was not reached. Review the event — confirm, reschedule or cancel.`
    };
  }

  if (next !== current) {
    await base44.entities.Auction.update(auctionId, { attendance_status: next });
    if (note) await notifyUser(base44, auctionOwnerId(auction), { ...note, link: '/auctioneer' });
  }
  return next;
}