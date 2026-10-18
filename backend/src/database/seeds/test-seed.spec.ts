import { buildTestListings, TEST_TITLE_PREFIX } from './test-seed';

describe('buildTestListings', () => {
  const now = new Date('2026-10-18T00:00:00Z');
  const listings = buildTestListings(now);

  it('builds 10 listings covering every status', () => {
    expect(listings).toHaveLength(10);
    const statuses = new Set(listings.map((l) => l.status));
    expect([...statuses].sort()).toEqual(['cancelled', 'closed', 'draft', 'open', 'upcoming']);
  });

  it('marks every listing as test data', () => {
    for (const listing of listings) {
      expect(listing.title.startsWith(TEST_TITLE_PREFIX)).toBe(true);
      expect(listing.itemCode.startsWith('TEST-')).toBe(true);
    }
  });

  it('uses positive integer cents and a valid reserve', () => {
    for (const l of listings) {
      expect(Number.isInteger(l.startingBidCents) && l.startingBidCents > 0).toBe(true);
      expect(Number.isInteger(l.minIncrementCents) && l.minIncrementCents > 0).toBe(true);
      if (l.reservePriceCents !== null) {
        expect(l.reservePriceCents).toBeGreaterThanOrEqual(l.startingBidCents);
      }
    }
  });

  it('keeps dates consistent with each status', () => {
    for (const l of listings) {
      if (l.startAt && l.endAt) expect(l.endAt.getTime()).toBeGreaterThan(l.startAt.getTime());
      if (l.status === 'upcoming') expect(l.startAt!.getTime()).toBeGreaterThan(now.getTime());
      if (l.status === 'open') {
        expect(l.startAt!.getTime()).toBeLessThanOrEqual(now.getTime());
        expect(l.endAt!.getTime()).toBeGreaterThan(now.getTime());
      }
      if (l.status === 'closed') expect(l.endAt!.getTime()).toBeLessThan(now.getTime());
      if (l.status === 'draft') expect(l.publishedAt).toBeNull();
      if (l.status === 'cancelled') expect(l.cancelReason).toBeTruthy();
    }
  });

  it('only has bids that follow the starting bid and minimum increment', () => {
    for (const l of listings) {
      let previous: number | null = null;
      for (const bid of l.bids) {
        const minimum: number = previous === null ? l.startingBidCents : previous + l.minIncrementCents;
        expect(bid.amountCents).toBeGreaterThanOrEqual(minimum);
        expect(bid.at.getTime()).toBeGreaterThanOrEqual(l.startAt!.getTime());
        previous = bid.amountCents;
      }
      if (l.bids.length > 0) expect(['open', 'closed']).toContain(l.status);
    }
  });
});
