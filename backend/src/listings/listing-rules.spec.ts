import { AuthUser } from '../auth/auth-user';
import {
  canView,
  DAY_MS,
  lockedFields,
  MINUTE_MS,
  priceProblems,
  publishProblems,
  reserveStatus,
  scheduleProblems,
  statusOnPublish,
} from './listing-rules';

const owner: AuthUser = { id: 'owner', role: 'user', emailVerified: true };
const other: AuthUser = { id: 'other', role: 'user', emailVerified: true };
const admin: AuthUser = { id: 'admin', role: 'admin', emailVerified: true };
const now = new Date('2026-10-18T00:00:00Z');
const at = (ms: number) => new Date(now.getTime() + ms);

describe('canView', () => {
  it.each(['draft', 'cancelled'] as const)('hides %s listings from everyone but owner and admin', (status) => {
    const listing = { sellerId: 'owner', status, isHidden: false };
    expect(canView(listing, null)).toBe(false);
    expect(canView(listing, other)).toBe(false);
    expect(canView(listing, owner)).toBe(true);
    expect(canView(listing, admin)).toBe(true);
  });

  it('hides moderated listings and shows published ones', () => {
    expect(canView({ sellerId: 'owner', status: 'open', isHidden: true }, other)).toBe(false);
    expect(canView({ sellerId: 'owner', status: 'open', isHidden: true }, owner)).toBe(true);
    expect(canView({ sellerId: 'owner', status: 'upcoming', isHidden: false }, null)).toBe(true);
  });
});

describe('lockedFields', () => {
  const changed = ['startingBidCents', 'description', 'endAt', 'viewingNotes', 'auctioneerId'];

  it('locks nothing before bidding starts', () => {
    expect(lockedFields({ status: 'upcoming', bidCount: 0 }, changed)).toEqual([]);
  });

  it('locks everything but description, viewing notes and admin fields after the first bid', () => {
    expect(lockedFields({ status: 'open', bidCount: 1 }, changed)).toEqual(['startingBidCents', 'endAt']);
  });

  it('locks once the auction is open, even with no bids', () => {
    expect(lockedFields({ status: 'open', bidCount: 0 }, ['title'])).toEqual(['title']);
  });
});

describe('scheduleProblems and publishProblems', () => {
  it('requires a 5-minute lead time, end after start and at most 30 days', () => {
    const fields = (s: Date, e: Date) =>
      scheduleProblems(s, e, now, { forPublish: true }).map((p) => p.message);
    expect(fields(at(4 * MINUTE_MS), at(DAY_MS))).toContain('Start time must be at least 5 minutes from now.');
    expect(fields(at(DAY_MS), at(DAY_MS))).toContain('End time must be after the start time.');
    expect(fields(at(DAY_MS), at(32 * DAY_MS))).toContain('An auction can run for at most 30 days.');
    expect(fields(at(5 * MINUTE_MS), at(5 * MINUTE_MS + 30 * DAY_MS))).toEqual([]);
  });

  it('does not require a schedule for drafts', () => {
    expect(scheduleProblems(null, null, now, { forPublish: false })).toEqual([]);
  });

  it('requires a photo and a category to publish', () => {
    const problems = publishProblems({ categoryId: null, startAt: at(DAY_MS), endAt: at(2 * DAY_MS) }, 0, now);
    expect(problems.map((p) => p.field)).toEqual(['images', 'categoryId']);
  });
});

describe('statusOnPublish', () => {
  it('opens an online auction whose start has passed, else upcoming', () => {
    expect(statusOnPublish({ startAt: at(-1), biddingType: 'online', auctioneerId: null }, now)).toBe('open');
    expect(statusOnPublish({ startAt: at(DAY_MS), biddingType: 'online', auctioneerId: null }, now)).toBe('upcoming');
  });

  it('keeps physical and hybrid auctions upcoming until an auctioneer is assigned', () => {
    expect(statusOnPublish({ startAt: at(-1), biddingType: 'physical', auctioneerId: null }, now)).toBe('upcoming');
    expect(statusOnPublish({ startAt: at(-1), biddingType: 'hybrid', auctioneerId: 'a' }, now)).toBe('open');
  });
});

describe('priceProblems and reserveStatus', () => {
  it('rejects a reserve below the starting bid', () => {
    expect(priceProblems({ startingBidCents: 1000, minIncrementCents: 100, reservePriceCents: 999 })).toHaveLength(1);
    expect(priceProblems({ startingBidCents: 1000, minIncrementCents: 100, reservePriceCents: null })).toEqual([]);
  });

  it('reports none, not_met and met', () => {
    expect(reserveStatus(null, 5000)).toBe('none');
    expect(reserveStatus(5000, null)).toBe('not_met');
    expect(reserveStatus(5000, 4999)).toBe('not_met');
    expect(reserveStatus(5000, 5000)).toBe('met');
  });
});
