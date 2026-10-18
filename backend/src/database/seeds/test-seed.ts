// =============================================================================
// TEST DATA ONLY. Never run against production.
// Every test user has an @test.wolvo.invalid email, a "TEST " display name and
// the password below. Every test listing title starts with "[TEST]" and every
// item code with "TEST-". Re-running the seed replaces the previous test data.
// =============================================================================
import * as argon2 from 'argon2';
import { DataSource, EntityManager } from 'typeorm';

export const TEST_EMAIL_DOMAIN = 'test.wolvo.invalid';
export const TEST_PASSWORD = 'TestPassword123!';
export const TEST_TITLE_PREFIX = '[TEST]';

type Role = 'user' | 'auctioneer' | 'moderator' | 'admin';
type UserKey = 'admin' | 'auctioneer' | 'seller1' | 'seller2' | 'buyer1' | 'buyer2';

export const TEST_USERS: { key: UserKey; displayName: string; role: Role }[] = [
  { key: 'admin', displayName: 'TEST Admin', role: 'admin' },
  { key: 'auctioneer', displayName: 'TEST Auctioneer', role: 'auctioneer' },
  { key: 'seller1', displayName: 'TEST Seller One', role: 'user' },
  { key: 'seller2', displayName: 'TEST Seller Two', role: 'user' },
  { key: 'buyer1', displayName: 'TEST Buyer One', role: 'user' },
  { key: 'buyer2', displayName: 'TEST Buyer Two', role: 'user' },
];

export const CATEGORIES = [
  { slug: 'furniture', name: 'Furniture' },
  { slug: 'tools-hardware', name: 'Tools & Hardware' },
  { slug: 'vehicles', name: 'Vehicles' },
  { slug: 'collectables-antiques', name: 'Collectables & Antiques' },
  { slug: 'homewares', name: 'Homewares' },
  { slug: 'music-instruments', name: 'Music & Instruments' },
  { slug: 'garden-outdoor', name: 'Garden & Outdoor' },
  { slug: 'jewellery-watches', name: 'Jewellery & Watches' },
];

export type AuctionStatus = 'draft' | 'upcoming' | 'open' | 'closed' | 'cancelled';

export interface TestListing {
  itemCode: string;
  title: string;
  description: string;
  categorySlug: string;
  condition: string;
  suburb: string;
  state: string;
  lotNumber: string;
  seller: UserKey;
  auctioneer: UserKey | null;
  status: AuctionStatus;
  isHidden: boolean;
  featured: boolean;
  cancelReason: string | null;
  startingBidCents: number;
  minIncrementCents: number;
  reservePriceCents: number | null;
  biddingType: 'online' | 'physical' | 'hybrid';
  startAt: Date | null;
  endAt: Date | null;
  publishedAt: Date | null;
  viewingNotes: string | null;
  // Bids in the order they were placed; amounts in cents.
  bids: { bidder: UserKey; amountCents: number; at: Date }[];
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Ten listings covering every status, with dates relative to `now` so each
// status stays consistent with its start and end times.
export function buildTestListings(now: Date): TestListing[] {
  const at = (offsetMs: number) => new Date(now.getTime() + offsetMs);
  const base = {
    isHidden: false,
    featured: false,
    cancelReason: null,
    auctioneer: null,
    reservePriceCents: null,
    biddingType: 'online' as const,
    viewingNotes: null,
    bids: [],
  };

  return [
    {
      ...base,
      itemCode: 'TEST-0001',
      title: `${TEST_TITLE_PREFIX} Vintage Cedar Blanket Box`,
      description: 'Solid cedar blanket box with brass hinges. Draft, not yet scheduled.',
      categorySlug: 'furniture',
      condition: 'used_good',
      suburb: 'Fitzroy',
      state: 'VIC',
      lotNumber: 'T-001',
      seller: 'seller1',
      status: 'draft',
      startingBidCents: 5000,
      minIncrementCents: 500,
      startAt: null,
      endAt: null,
      publishedAt: null,
    },
    {
      ...base,
      itemCode: 'TEST-0002',
      title: `${TEST_TITLE_PREFIX} Makita 18V Cordless Drill Kit`,
      description: 'Drill, two batteries and charger. Draft with a planned schedule.',
      categorySlug: 'tools-hardware',
      condition: 'used_like_new',
      suburb: 'Parramatta',
      state: 'NSW',
      lotNumber: 'T-002',
      seller: 'seller2',
      status: 'draft',
      startingBidCents: 8000,
      minIncrementCents: 500,
      startAt: at(7 * DAY),
      endAt: at(14 * DAY),
      publishedAt: null,
    },
    {
      ...base,
      itemCode: 'TEST-0003',
      title: `${TEST_TITLE_PREFIX} Mid-Century Teak Sideboard`,
      description: 'Danish-style teak sideboard, 180 cm. Upcoming online auction.',
      categorySlug: 'furniture',
      condition: 'used_good',
      suburb: 'New Farm',
      state: 'QLD',
      lotNumber: 'T-003',
      seller: 'seller1',
      auctioneer: 'auctioneer',
      status: 'upcoming',
      startingBidCents: 40000,
      minIncrementCents: 2500,
      reservePriceCents: 90000,
      startAt: at(2 * DAY),
      endAt: at(9 * DAY),
      publishedAt: at(-1 * DAY),
    },
    {
      ...base,
      itemCode: 'TEST-0004',
      title: `${TEST_TITLE_PREFIX} Victorian Silver Pocket Watch`,
      description: 'Hallmarked silver pocket watch, working. Upcoming in-person auction.',
      categorySlug: 'jewellery-watches',
      condition: 'antique_collectable',
      suburb: 'Glenelg',
      state: 'SA',
      lotNumber: 'T-004',
      seller: 'seller2',
      auctioneer: 'auctioneer',
      status: 'upcoming',
      biddingType: 'physical',
      startingBidCents: 15000,
      minIncrementCents: 1000,
      startAt: at(5 * DAY),
      endAt: at(5 * DAY + 3 * HOUR),
      publishedAt: at(-2 * DAY),
      viewingNotes: 'Viewing at the venue from 9am on auction day.',
    },
    {
      ...base,
      itemCode: 'TEST-0005',
      title: `${TEST_TITLE_PREFIX} Ducati Monster 821 (2019)`,
      description: '2019 Ducati Monster 821, 12,400 km, logbook serviced. Featured.',
      categorySlug: 'vehicles',
      condition: 'used_good',
      suburb: 'Osborne Park',
      state: 'WA',
      lotNumber: 'T-005',
      seller: 'seller1',
      auctioneer: 'auctioneer',
      status: 'open',
      featured: true,
      startingBidCents: 800000,
      minIncrementCents: 10000,
      reservePriceCents: 1000000,
      startAt: at(-2 * DAY),
      endAt: at(3 * DAY),
      publishedAt: at(-3 * DAY),
      bids: [
        { bidder: 'buyer1', amountCents: 800000, at: at(-36 * HOUR) },
        { bidder: 'buyer2', amountCents: 820000, at: at(-30 * HOUR) },
        { bidder: 'buyer1', amountCents: 850000, at: at(-6 * HOUR) },
      ],
    },
    {
      ...base,
      itemCode: 'TEST-0006',
      title: `${TEST_TITLE_PREFIX} Royal Doulton 24-Piece Dinner Set`,
      description: 'Complete dinner set, no chips. Hybrid auction.',
      categorySlug: 'homewares',
      condition: 'used_like_new',
      suburb: 'Sandy Bay',
      state: 'TAS',
      lotNumber: 'T-006',
      seller: 'seller2',
      auctioneer: 'auctioneer',
      status: 'open',
      biddingType: 'hybrid',
      startingBidCents: 12000,
      minIncrementCents: 1000,
      startAt: at(-1 * DAY),
      endAt: at(1 * DAY),
      publishedAt: at(-2 * DAY),
      viewingNotes: 'Inspection by appointment.',
      bids: [{ bidder: 'buyer2', amountCents: 12000, at: at(-12 * HOUR) }],
    },
    {
      ...base,
      itemCode: 'TEST-0007',
      title: `${TEST_TITLE_PREFIX} Weber Family Q BBQ`,
      description: 'Open auction hidden by an admin for moderation review.',
      categorySlug: 'garden-outdoor',
      condition: 'used_fair',
      suburb: 'Belconnen',
      state: 'ACT',
      lotNumber: 'T-007',
      seller: 'seller1',
      status: 'open',
      isHidden: true,
      startingBidCents: 10000,
      minIncrementCents: 1000,
      startAt: at(-1 * DAY),
      endAt: at(4 * DAY),
      publishedAt: at(-1 * DAY),
    },
    {
      ...base,
      itemCode: 'TEST-0008',
      title: `${TEST_TITLE_PREFIX} Fender Player Stratocaster`,
      description: 'Closed auction; reserve met.',
      categorySlug: 'music-instruments',
      condition: 'used_like_new',
      suburb: 'Darwin City',
      state: 'NT',
      lotNumber: 'T-008',
      seller: 'seller2',
      status: 'closed',
      startingBidCents: 60000,
      minIncrementCents: 2500,
      reservePriceCents: 70000,
      startAt: at(-10 * DAY),
      endAt: at(-3 * DAY),
      publishedAt: at(-11 * DAY),
      bids: [
        { bidder: 'buyer1', amountCents: 60000, at: at(-9 * DAY) },
        { bidder: 'buyer2', amountCents: 65000, at: at(-8 * DAY) },
        { bidder: 'buyer1', amountCents: 72500, at: at(-4 * DAY) },
      ],
    },
    {
      ...base,
      itemCode: 'TEST-0009',
      title: `${TEST_TITLE_PREFIX} Hand-Knotted Persian Rug 2 x 3 m`,
      description: 'Closed auction with no bids.',
      categorySlug: 'collectables-antiques',
      condition: 'antique_collectable',
      suburb: 'Toorak',
      state: 'VIC',
      lotNumber: 'T-009',
      seller: 'seller1',
      status: 'closed',
      startingBidCents: 150000,
      minIncrementCents: 5000,
      startAt: at(-14 * DAY),
      endAt: at(-7 * DAY),
      publishedAt: at(-15 * DAY),
    },
    {
      ...base,
      itemCode: 'TEST-0010',
      title: `${TEST_TITLE_PREFIX} Colorbond Garden Shed Kit`,
      description: 'Cancelled before bidding started.',
      categorySlug: 'garden-outdoor',
      condition: 'new',
      suburb: 'Townsville',
      state: 'QLD',
      lotNumber: 'T-010',
      seller: 'seller2',
      status: 'cancelled',
      cancelReason: 'Seller withdrew the item before the auction opened.',
      startingBidCents: 30000,
      minIncrementCents: 1000,
      startAt: at(3 * DAY),
      endAt: at(10 * DAY),
      publishedAt: at(-1 * DAY),
    },
  ];
}

// Removes any previous test data (identified by the test email domain and
// item-code prefix) so the seed can be re-run.
async function deleteTestData(em: EntityManager): Promise<void> {
  const testUsers = `SELECT id FROM users WHERE email LIKE '%@${TEST_EMAIL_DOMAIN}'`;
  const testAuctions = `SELECT id FROM auctions WHERE item_code LIKE 'TEST-%' OR seller_id IN (${testUsers})`;
  await em.query(`DELETE FROM bids WHERE auction_id IN (${testAuctions}) OR bidder_id IN (${testUsers})`);
  await em.query(`DELETE FROM watchlist WHERE user_id IN (${testUsers}) OR auction_id IN (${testAuctions})`);
  await em.query(`DELETE FROM audit_log WHERE actor_id IN (${testUsers})`);
  await em.query(`DELETE FROM auctions WHERE id IN (${testAuctions})`);
  await em.query(`DELETE FROM users WHERE email LIKE '%@${TEST_EMAIL_DOMAIN}'`);
}

export interface SeedSummary {
  users: number;
  categories: number;
  listings: number;
  bids: number;
  watchlist: number;
}

export async function seedTestData(dataSource: DataSource, now = new Date()): Promise<SeedSummary> {
  const passwordHash = await argon2.hash(TEST_PASSWORD, { type: argon2.argon2id });

  return dataSource.transaction(async (em) => {
    await deleteTestData(em);

    const userIds = {} as Record<UserKey, string>;
    for (const user of TEST_USERS) {
      const [row] = await em.query(
        `INSERT INTO users (email, password_hash, display_name, role, email_verified_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [`${user.key}@${TEST_EMAIL_DOMAIN}`, passwordHash, user.displayName, user.role, now],
      );
      userIds[user.key] = row.id;
    }

    // Categories are shared reference data, so they are upserted, not deleted.
    const categoryIds: Record<string, string> = {};
    for (const [index, category] of CATEGORIES.entries()) {
      const [row] = await em.query(
        `INSERT INTO categories (name, slug, sort_order) VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [category.name, category.slug, index],
      );
      categoryIds[category.slug] = row.id;
    }

    const auctionIds: Record<string, string> = {};
    let bidCount = 0;
    for (const listing of buildTestListings(now)) {
      const [row] = await em.query(
        `INSERT INTO auctions (
           title, description, category_id, condition, suburb, state, lot_number,
           seller_id, auctioneer_id, status, is_hidden, featured, cancel_reason,
           starting_bid_cents, min_increment_cents, reserve_price_cents, bidding_type,
           start_at, end_at, published_at, viewing_notes, item_code
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
         RETURNING id`,
        [
          listing.title,
          listing.description,
          categoryIds[listing.categorySlug],
          listing.condition,
          listing.suburb,
          listing.state,
          listing.lotNumber,
          userIds[listing.seller],
          listing.auctioneer ? userIds[listing.auctioneer] : null,
          listing.status,
          listing.isHidden,
          listing.featured,
          listing.cancelReason,
          listing.startingBidCents,
          listing.minIncrementCents,
          listing.reservePriceCents,
          listing.biddingType,
          listing.startAt,
          listing.endAt,
          listing.publishedAt,
          listing.viewingNotes,
          listing.itemCode,
        ],
      );
      auctionIds[listing.itemCode] = row.id;

      for (const bid of listing.bids) {
        await em.query(
          `INSERT INTO bids (auction_id, bidder_id, amount_cents, created_at) VALUES ($1, $2, $3, $4)`,
          [row.id, userIds[bid.bidder], bid.amountCents, bid.at],
        );
        bidCount += 1;
      }
    }

    const watches: [UserKey, string][] = [
      ['buyer1', 'TEST-0003'],
      ['buyer1', 'TEST-0005'],
      ['buyer2', 'TEST-0006'],
    ];
    for (const [user, itemCode] of watches) {
      await em.query(`INSERT INTO watchlist (user_id, auction_id) VALUES ($1, $2)`, [
        userIds[user],
        auctionIds[itemCode],
      ]);
    }

    return {
      users: TEST_USERS.length,
      categories: CATEGORIES.length,
      listings: Object.keys(auctionIds).length,
      bids: bidCount,
      watchlist: watches.length,
    };
  });
}
