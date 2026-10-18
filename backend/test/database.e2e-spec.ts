import 'dotenv/config';
import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { buildDataSourceOptions } from '../src/config/database.config';
import { seedTestData } from '../src/database/seeds/test-seed';

// Runs against a real PostgreSQL database (DB_TEST_DATABASE), which is dropped
// and recreated for every run.
const testDb = process.env.DB_TEST_DATABASE ?? 'wolvo_test';
if (testDb === process.env.DB_DATABASE) {
  throw new Error('DB_TEST_DATABASE must differ from DB_DATABASE.');
}

async function adminQuery(sql: string): Promise<void> {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

describe('Database schema (e2e, real PostgreSQL)', () => {
  let ds: DataSource;

  beforeAll(async () => {
    await adminQuery(`DROP DATABASE IF EXISTS "${testDb}" WITH (FORCE)`);
    await adminQuery(`CREATE DATABASE "${testDb}"`);
    ds = new DataSource(buildDataSourceOptions(process.env, { database: testDb }));
    await ds.initialize();
  });

  afterAll(async () => {
    await ds?.destroy();
    await adminQuery(`DROP DATABASE IF EXISTS "${testDb}" WITH (FORCE)`);
  });

  it('applies all migrations to a fresh database', async () => {
    const applied = await ds.runMigrations({ transaction: 'each' });
    expect(applied.map((m) => m.name)).toEqual([
      'M1Foundation1792281600000',
      'M2MarketplaceCore1792285200000',
    ]);
  });

  it('creates every requested auctions column', async () => {
    const rows: { column_name: string }[] = await ds.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'auctions'`,
    );
    const columns = rows.map((r) => r.column_name);
    for (const column of [
      'seller_id', 'auctioneer_id', 'status', 'is_hidden', 'featured', 'cancel_reason',
      'published_at', 'title', 'description', 'category_id', 'condition', 'suburb', 'state',
      'lot_number', 'starting_bid_cents', 'min_increment_cents', 'reserve_price_cents',
      'bidding_type', 'start_at', 'end_at', 'viewing_notes', 'item_code',
    ]) {
      expect(columns).toContain(column);
    }
  });

  it('creates the requested indexes', async () => {
    const rows: { indexname: string }[] = await ds.query(
      `SELECT indexname FROM pg_indexes WHERE schemaname = 'public'`,
    );
    const names = rows.map((r) => r.indexname);
    expect(names).toEqual(
      expect.arrayContaining([
        'auctions_seller_status_idx',
        'auctions_status_end_at_idx',
        'auctions_is_hidden_idx',
        'auction_images_auction_position_idx',
        'watchlist_pkey',
      ]),
    );
  });

  describe('constraints', () => {
    let sellerId: string;

    beforeAll(async () => {
      const [user] = await ds.query(
        `INSERT INTO users (email, password_hash, display_name) VALUES ('c@test.wolvo.invalid', 'x', 'TEST C') RETURNING id`,
      );
      sellerId = user.id;
    });

    const insertAuction = (fields: Record<string, unknown>) => {
      const row = { title: 'TEST constraint', seller_id: sellerId, starting_bid_cents: 1000, ...fields };
      const keys = Object.keys(row);
      return ds.query(
        `INSERT INTO auctions (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
        Object.values(row),
      );
    };

    it('rejects non-positive amounts', async () => {
      await expect(insertAuction({ starting_bid_cents: 0 })).rejects.toThrow(/auctions_starting_bid_positive/);
      await expect(insertAuction({ min_increment_cents: -5 })).rejects.toThrow(/auctions_min_increment_positive/);
    });

    it('rejects end_at at or before start_at', async () => {
      const t = '2026-11-01T00:00:00Z';
      await expect(insertAuction({ start_at: t, end_at: t })).rejects.toThrow(/auctions_end_after_start/);
    });

    it('rejects a reserve below the starting bid but allows null', async () => {
      await expect(insertAuction({ reserve_price_cents: 999 })).rejects.toThrow(/auctions_reserve_valid/);
      await expect(insertAuction({ reserve_price_cents: null })).resolves.toHaveLength(1);
      await expect(insertAuction({ reserve_price_cents: 1000 })).resolves.toHaveLength(1);
    });

    it('requires a seller and rejects unknown statuses and states', async () => {
      await expect(insertAuction({ seller_id: null })).rejects.toThrow(/null value/);
      await expect(insertAuction({ status: 'live' })).rejects.toThrow(/auction_status/);
      await expect(insertAuction({ state: 'XX' })).rejects.toThrow(/au_state/);
    });

    it('allows each user to watch an auction only once', async () => {
      const [auction] = await insertAuction({});
      await ds.query(`INSERT INTO watchlist (user_id, auction_id) VALUES ($1, $2)`, [sellerId, auction.id]);
      await expect(
        ds.query(`INSERT INTO watchlist (user_id, auction_id) VALUES ($1, $2)`, [sellerId, auction.id]),
      ).rejects.toThrow(/watchlist_pkey/);
    });

    afterAll(async () => {
      await ds.query(`DELETE FROM watchlist WHERE user_id = $1`, [sellerId]);
      await ds.query(`DELETE FROM auctions WHERE seller_id = $1`, [sellerId]);
      await ds.query(`DELETE FROM users WHERE id = $1`, [sellerId]);
    });
  });

  it('loads the test seed, and re-running it replaces rather than duplicates', async () => {
    const summary = await seedTestData(ds);
    expect(summary).toEqual({ users: 6, categories: 8, listings: 10, bids: 7, watchlist: 3 });
    await seedTestData(ds);

    const [counts] = await ds.query(`
      SELECT
        (SELECT count(*)::int FROM users WHERE email LIKE '%@test.wolvo.invalid') AS users,
        (SELECT count(*)::int FROM categories) AS categories,
        (SELECT count(*)::int FROM auctions) AS listings,
        (SELECT count(*)::int FROM bids) AS bids,
        (SELECT count(DISTINCT status)::int FROM auctions) AS statuses
    `);
    expect(counts).toEqual({ users: 6, categories: 8, listings: 10, bids: 7, statuses: 5 });
  });

  it('boots the Nest app against the migrated database', async () => {
    process.env.DB_DATABASE = testDb;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    const appDs = app.get(DataSource);
    expect(await appDs.query(`SELECT 1 AS ok`)).toEqual([{ ok: 1 }]);
    await app.close();
  });

  it('reverts both migrations cleanly', async () => {
    await ds.query(`DELETE FROM watchlist; DELETE FROM bids; DELETE FROM auctions; DELETE FROM users;`);
    await ds.undoLastMigration({ transaction: 'each' });
    await ds.undoLastMigration({ transaction: 'each' });
    const rows: { table_name: string }[] = await ds.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name <> 'migrations'`,
    );
    expect(rows).toEqual([]);
  });
});
