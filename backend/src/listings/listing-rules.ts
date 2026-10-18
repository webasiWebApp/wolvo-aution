import { AuthUser, isAdmin } from '../auth/auth-user';
import { AuctionStatus, BiddingType } from './entities/auction.entity';

// Pure listing rules, kept free of Nest and TypeORM so they are unit-testable.

export const MINUTE_MS = 60 * 1000;
export const DAY_MS = 24 * 60 * MINUTE_MS;
export const PUBLISH_MIN_LEAD_MS = 5 * MINUTE_MS;
export const MAX_DURATION_MS = 30 * DAY_MS;

// Editable by the owner even after the first bid.
export const ALWAYS_EDITABLE_FIELDS = ['description', 'viewingNotes'] as const;
// Only an admin may change these.
export const ADMIN_ONLY_FIELDS = ['auctioneerId', 'featured', 'isHidden'] as const;

export interface ListingState {
  sellerId: string;
  status: AuctionStatus;
  isHidden: boolean;
}

export type ReserveStatus = 'none' | 'not_met' | 'met';

export interface Problem {
  field: string;
  message: string;
}

export const isOwner = (listing: Pick<ListingState, 'sellerId'>, user: AuthUser | null): boolean =>
  !!user && listing.sellerId === user.id;

// Drafts, cancelled and hidden listings exist only for the owner and admins.
export function canView(listing: ListingState, user: AuthUser | null): boolean {
  if (isAdmin(user) || isOwner(listing, user)) return true;
  return !listing.isHidden && listing.status !== 'draft' && listing.status !== 'cancelled';
}

// Fields are locked once bidding has started (first bid, or the auction is open).
export function lockedFields(
  listing: { status: AuctionStatus; bidCount: number },
  changedFields: string[],
): string[] {
  const biddingStarted = listing.bidCount > 0 || listing.status === 'open';
  if (!biddingStarted) return [];
  const allowed = new Set<string>([...ALWAYS_EDITABLE_FIELDS, ...ADMIN_ONLY_FIELDS]);
  return changedFields.filter((field) => !allowed.has(field));
}

export function priceProblems(p: {
  startingBidCents: number;
  minIncrementCents: number;
  reservePriceCents: number | null;
}): Problem[] {
  const problems: Problem[] = [];
  if (p.reservePriceCents !== null && p.reservePriceCents < p.startingBidCents) {
    problems.push({ field: 'reservePriceCents', message: 'Reserve must be at least the starting bid.' });
  }
  return problems;
}

// Shape of the schedule. For publishing, also checks the 5-minute lead time.
export function scheduleProblems(
  startAt: Date | null,
  endAt: Date | null,
  now: Date,
  options: { forPublish: boolean },
): Problem[] {
  const problems: Problem[] = [];
  if (options.forPublish) {
    if (!startAt) problems.push({ field: 'startAt', message: 'Start time is required.' });
    if (!endAt) problems.push({ field: 'endAt', message: 'End time is required.' });
  }
  if (startAt && options.forPublish && startAt.getTime() < now.getTime() + PUBLISH_MIN_LEAD_MS) {
    problems.push({ field: 'startAt', message: 'Start time must be at least 5 minutes from now.' });
  }
  if (startAt && endAt) {
    if (endAt.getTime() <= startAt.getTime()) {
      problems.push({ field: 'endAt', message: 'End time must be after the start time.' });
    } else if (endAt.getTime() - startAt.getTime() > MAX_DURATION_MS) {
      problems.push({ field: 'endAt', message: 'An auction can run for at most 30 days.' });
    }
  }
  return problems;
}

export function publishProblems(
  listing: { categoryId: string | null; startAt: Date | null; endAt: Date | null },
  imageCount: number,
  now: Date,
): Problem[] {
  const problems: Problem[] = [];
  if (imageCount < 1) problems.push({ field: 'images', message: 'Add at least one photo.' });
  if (!listing.categoryId) problems.push({ field: 'categoryId', message: 'Choose a category.' });
  return [...problems, ...scheduleProblems(listing.startAt, listing.endAt, now, { forPublish: true })];
}

// Physical and hybrid auctions need an auctioneer before they can open.
export const needsAuctioneer = (biddingType: BiddingType): boolean => biddingType !== 'online';

export function statusOnPublish(
  listing: { startAt: Date; biddingType: BiddingType; auctioneerId: string | null },
  now: Date,
): 'upcoming' | 'open' {
  const canOpen = !needsAuctioneer(listing.biddingType) || listing.auctioneerId !== null;
  return listing.startAt.getTime() <= now.getTime() && canOpen ? 'open' : 'upcoming';
}

export function reserveStatus(reserveCents: number | null, currentBidCents: number | null): ReserveStatus {
  if (reserveCents === null) return 'none';
  return currentBidCents !== null && currentBidCents >= reserveCents ? 'met' : 'not_met';
}
