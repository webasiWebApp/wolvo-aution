import 'dotenv/config';
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { Client } from 'pg';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { ListingLifecycleService } from '../src/listings/listing-lifecycle.service';

// Runs against a real PostgreSQL database, recreated for every run.
const testDb = `${process.env.DB_TEST_DATABASE ?? 'wolvo_test'}_listings`;
const PASSWORD = 'TestPassword123!';
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const inFuture = (ms: number) => new Date(Date.now() + ms).toISOString();

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

describe('Listings (e2e, real PostgreSQL)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let lifecycle: ListingLifecycleService;
  let categoryId: string;
  const ids: Record<string, string> = {};
  const tokens: Record<string, string> = {};

  const api = () => request(app.getHttpServer());
  const as = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const validDraft = (overrides: Record<string, unknown> = {}) => ({
    title: 'TEST Teak sideboard',
    description: 'Solid teak, 180 cm.',
    categoryId,
    condition: 'used_good',
    suburb: 'Fitzroy',
    state: 'VIC',
    startingBidCents: 40000,
    minIncrementCents: 2500,
    reservePriceCents: 90000,
    startAt: inFuture(DAY),
    endAt: inFuture(8 * DAY),
    ...overrides,
  });
  const addPhoto = (listingId: string) =>
    ds.query(`INSERT INTO auction_images (auction_id, storage_key, position) VALUES ($1, $2, 0)`, [
      listingId,
      `test/${listingId}/1.jpg`,
    ]);
  const openNow = async (listingId: string) => {
    await ds.query(`UPDATE auctions SET start_at = now() - interval '1 minute' WHERE id = $1`, [listingId]);
    return lifecycle.openDue();
  };
  const auditRows = (listingId: string) =>
    ds.query(`SELECT action, actor_id, before, after FROM audit_log WHERE entity_id = $1 ORDER BY created_at`, [
      listingId,
    ]);

  beforeAll(async () => {
    await adminQuery(`DROP DATABASE IF EXISTS "${testDb}" WITH (FORCE)`);
    await adminQuery(`CREATE DATABASE "${testDb}"`);
    Object.assign(process.env, {
      DB_DATABASE: testDb,
      JWT_SECRET: 'e2e-test-secret-not-for-production',
      SCHEDULER_ENABLED: 'false',
      LISTING_CREATE_LIMIT: '5',
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    ds = app.get(DataSource);
    lifecycle = app.get(ListingLifecycleService);
    await ds.runMigrations({ transaction: 'each' });

    const hash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
    const users: [string, string, boolean][] = [
      ['seller', 'user', true],
      ['other', 'user', true],
      ['buyer', 'user', true],
      ['unverified', 'user', false],
      ['admin', 'admin', true],
      ['auctioneer', 'auctioneer', true],
      ['spammer', 'user', true],
    ];
    for (const [key, role, verified] of users) {
      const [row] = await ds.query(
        `INSERT INTO users (email, password_hash, display_name, role, email_verified_at)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [`${key}@test.wolvo.invalid`, hash, `TEST ${key}`, role, verified ? new Date() : null],
      );
      ids[key] = row.id;
      const res = await api().post('/api/v1/auth/login').send({ email: `${key}@test.wolvo.invalid`, password: PASSWORD });
      expect(res.status).toBe(200);
      tokens[key] = res.body.accessToken;
    }
    const [category] = await ds.query(
      `INSERT INTO categories (name, slug) VALUES ('Furniture', 'furniture') RETURNING id`,
    );
    categoryId = category.id;
  });

  afterAll(async () => {
    await app?.close();
    await adminQuery(`DROP DATABASE IF EXISTS "${testDb}" WITH (FORCE)`);
  });

  describe('creating', () => {
    it('requires sign-in and a verified email', async () => {
      expect((await api().post('/api/v1/listings').send(validDraft())).status).toBe(401);
      const res = await api().post('/api/v1/listings').set(as('unverified')).send(validDraft());
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
    });

    it('rejects invalid input with the standard error shape', async () => {
      const res = await api()
        .post('/api/v1/listings')
        .set(as('seller'))
        .send({ title: 'x', startingBidCents: 10.5, sellerId: ids.other });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ statusCode: 400, error: 'VALIDATION_FAILED', path: '/api/v1/listings' });
      expect(Object.keys(res.body.details)).toEqual(expect.arrayContaining(['title', 'startingBidCents', 'sellerId']));
    });

    it('rejects a reserve below the starting bid', async () => {
      const res = await api()
        .post('/api/v1/listings')
        .set(as('seller'))
        .send(validDraft({ reservePriceCents: 100 }));
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('LISTING_INVALID');
    });
  });

  describe('a seller creates and publishes a listing', () => {
    let listingId: string;

    it('creates a draft owned by the caller', async () => {
      const res = await api().post('/api/v1/listings').set(as('seller')).send(validDraft());
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ status: 'draft', sellerId: ids.seller, reservePriceCents: 90000 });
      listingId = res.body.id;
    });

    it('hides the draft from other users and anonymous callers', async () => {
      for (const headers of [as('other'), {}]) {
        const res = await api().get(`/api/v1/listings/${listingId}`).set(headers);
        expect(res.status).toBe(404);
        expect(res.body.error).toBe('LISTING_NOT_FOUND');
      }
      expect((await api().get(`/api/v1/listings/${listingId}/manage`).set(as('other'))).status).toBe(404);
      expect((await api().get(`/api/v1/listings/${listingId}`).set(as('seller'))).status).toBe(200);
    });

    it('does not let another user edit, publish or cancel the draft', async () => {
      const edit = await api().patch(`/api/v1/listings/${listingId}`).set(as('other')).send({ title: 'Hijacked' });
      expect(edit.status).toBe(404);
      expect((await api().post(`/api/v1/listings/${listingId}/publish`).set(as('other'))).status).toBe(404);
      expect((await api().post(`/api/v1/listings/${listingId}/cancel`).set(as('other')).send({})).status).toBe(404);
      const [row] = await ds.query(`SELECT title FROM auctions WHERE id = $1`, [listingId]);
      expect(row.title).toBe('TEST Teak sideboard');
    });

    it('refuses to publish without a photo or with a bad schedule', async () => {
      let res = await api().post(`/api/v1/listings/${listingId}/publish`).set(as('seller'));
      expect(res.status).toBe(422);
      expect(res.body.error).toBe('PUBLISH_REQUIREMENTS_NOT_MET');
      expect(res.body.details.problems.map((p: { field: string }) => p.field)).toContain('images');

      await addPhoto(listingId);
      // A schedule longer than 30 days is rejected as soon as it is saved.
      const tooLong = await api()
        .patch(`/api/v1/listings/${listingId}`)
        .set(as('seller'))
        .send({ startAt: inFuture(DAY), endAt: inFuture(32 * DAY) });
      expect(tooLong.status).toBe(422);
      expect(tooLong.body.details.problems[0].message).toBe('An auction can run for at most 30 days.');

      // A draft may start soon, but publishing needs 5 minutes' lead time.
      const soon = await api()
        .patch(`/api/v1/listings/${listingId}`)
        .set(as('seller'))
        .send({ startAt: inFuture(2 * 60 * 1000), endAt: inFuture(DAY) });
      expect(soon.status).toBe(200);
      res = await api().post(`/api/v1/listings/${listingId}/publish`).set(as('seller'));
      expect(res.status).toBe(422);
      expect(res.body.details.problems.map((p: { message: string }) => p.message)).toEqual([
        'Start time must be at least 5 minutes from now.',
      ]);
    });

    it('publishes as upcoming and writes an audit entry', async () => {
      await api()
        .patch(`/api/v1/listings/${listingId}`)
        .set(as('seller'))
        .send({ startAt: inFuture(DAY), endAt: inFuture(8 * DAY) });
      const res = await api().post(`/api/v1/listings/${listingId}/publish`).set(as('seller'));
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('upcoming');
      expect(res.body.publishedAt).toBeTruthy();

      const audit = await auditRows(listingId);
      expect(audit.map((a: { action: string }) => a.action)).toEqual(['listing.publish']);
      expect(audit[0]).toMatchObject({ actor_id: ids.seller, before: { status: 'draft' }, after: { status: 'upcoming' } });

      expect((await api().get(`/api/v1/listings/${listingId}`)).status).toBe(200);
      ids.published = listingId;
    });
  });

  describe('the reserve is never public', () => {
    it('is absent from public responses but present for the owner', async () => {
      const id = ids.published;
      for (const headers of [{}, as('other'), as('seller'), as('admin')]) {
        const res = await api().get(`/api/v1/listings/${id}`).set(headers);
        expect(res.status).toBe(200);
        expect(JSON.stringify(res.body)).not.toMatch(/reserve_?price|90000/i);
        expect(res.body.reserveStatus).toBe('not_met');
      }
      const manage = await api().get(`/api/v1/listings/${id}/manage`).set(as('seller'));
      expect(manage.body.reservePriceCents).toBe(90000);
    });
  });

  describe('fields lock after the first bid', () => {
    it('opens on schedule, then locks money and schedule fields', async () => {
      const id = ids.published;
      expect(await openNow(id)).toContain(id);
      await ds.query(`INSERT INTO bids (auction_id, bidder_id, amount_cents) VALUES ($1, $2, 40000)`, [id, ids.buyer]);

      const res = await api()
        .patch(`/api/v1/listings/${id}`)
        .set(as('seller'))
        .send({
          startingBidCents: 100,
          minIncrementCents: 100,
          reservePriceCents: 40000,
          startAt: inFuture(DAY),
          endAt: inFuture(2 * DAY),
        });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('LISTING_FIELDS_LOCKED');
      expect(res.body.details.lockedFields.sort()).toEqual(
        ['endAt', 'minIncrementCents', 'reservePriceCents', 'startAt', 'startingBidCents'].sort(),
      );
      expect(res.body.message).toContain('startingBidCents');

      const [row] = await ds.query(`SELECT starting_bid_cents FROM auctions WHERE id = $1`, [id]);
      expect(row.starting_bid_cents).toBe(40000);
    });

    it('still allows description and viewing notes', async () => {
      const res = await api()
        .patch(`/api/v1/listings/${ids.published}`)
        .set(as('seller'))
        .send({ description: 'Now with keys.', viewingNotes: 'Saturday 9am.' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ description: 'Now with keys.', viewingNotes: 'Saturday 9am.' });
    });

    it('shows bid count, current bid and reserve status in /me/listings', async () => {
      const res = await api().get('/api/v1/me/listings').set(as('seller')).query({ status: 'open' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        id: ids.published,
        bidCount: 1,
        currentBidCents: 40000,
        reserveStatus: 'not_met',
        reservePriceCents: 90000,
      });
      expect((await api().get('/api/v1/me/listings').set(as('other'))).body).toEqual([]);
      expect((await api().get('/api/v1/me/listings').set(as('seller')).query({ status: 'live' })).status).toBe(400);
    });

    it('stops the seller cancelling after the first bid', async () => {
      const res = await api().post(`/api/v1/listings/${ids.published}/cancel`).set(as('seller')).send({});
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('LISTING_HAS_BIDS');
    });
  });

  describe('an admin cancels with a reason', () => {
    it('requires a reason', async () => {
      const res = await api().post(`/api/v1/listings/${ids.published}/cancel`).set(as('admin')).send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('CANCEL_REASON_REQUIRED');
    });

    it('cancels, records the reason and audits it', async () => {
      const id = ids.published;
      const res = await api()
        .post(`/api/v1/listings/${id}/cancel`)
        .set(as('admin'))
        .send({ reason: 'Counterfeit item reported.' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: 'cancelled', cancelReason: 'Counterfeit item reported.' });

      const audit = await auditRows(id);
      expect(audit.at(-1)).toMatchObject({ action: 'listing.admin_cancel', actor_id: ids.admin });

      expect((await api().get(`/api/v1/listings/${id}`).set(as('other'))).status).toBe(404);
      expect((await api().get(`/api/v1/listings/${id}`)).status).toBe(404);
      expect((await api().get(`/api/v1/listings/${id}/manage`).set(as('seller'))).status).toBe(200);
    });

    it('lets the seller cancel their own listing before any bids', async () => {
      const created = await api().post('/api/v1/listings').set(as('seller')).send(validDraft());
      const res = await api().post(`/api/v1/listings/${created.body.id}/cancel`).set(as('seller')).send({});
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('cancelled');
    });
  });

  describe('physical auctions need an auctioneer to open', () => {
    let id: string;

    it('stays upcoming at its start time without an auctioneer', async () => {
      const created = await api()
        .post('/api/v1/listings')
        .set(as('seller'))
        .send(validDraft({ biddingType: 'physical', endAt: inFuture(DAY + 3 * HOUR) }));
      id = created.body.id;
      await addPhoto(id);
      const published = await api().post(`/api/v1/listings/${id}/publish`).set(as('seller'));
      expect(published.body.status).toBe('upcoming');

      expect(await openNow(id)).not.toContain(id);
      const [row] = await ds.query(`SELECT status FROM auctions WHERE id = $1`, [id]);
      expect(row.status).toBe('upcoming');
    });

    it('only lets an admin assign an auctioneer, and the assignee must be one', async () => {
      const bySeller = await api().patch(`/api/v1/listings/${id}`).set(as('seller')).send({ auctioneerId: ids.auctioneer });
      expect(bySeller.status).toBe(403);
      expect(bySeller.body.error).toBe('ADMIN_ONLY_FIELDS');

      const wrongRole = await api().patch(`/api/v1/listings/${id}`).set(as('admin')).send({ auctioneerId: ids.buyer });
      expect(wrongRole.status).toBe(400);
      expect(wrongRole.body.error).toBe('INVALID_AUCTIONEER');
    });

    it('opens once an admin assigns an auctioneer, and audits the change', async () => {
      const res = await api().patch(`/api/v1/listings/${id}`).set(as('admin')).send({ auctioneerId: ids.auctioneer });
      expect(res.status).toBe(200);
      expect(await lifecycle.openDue()).toContain(id);

      const audit = await auditRows(id);
      expect(audit.at(-1)).toMatchObject({
        action: 'listing.admin_update',
        actor_id: ids.admin,
        before: { auctioneerId: null },
        after: { auctioneerId: ids.auctioneer },
      });
    });
  });

  describe('moderation and limits', () => {
    it('hides a listing from everyone but the owner and admins', async () => {
      // The buyer sells here, so the seller's creation limit is not involved.
      const created = await api().post('/api/v1/listings').set(as('buyer')).send(validDraft());
      const id = created.body.id;
      await addPhoto(id);
      await api().post(`/api/v1/listings/${id}/publish`).set(as('buyer'));

      const hidden = await api().patch(`/api/v1/listings/${id}`).set(as('admin')).send({ isHidden: true });
      expect(hidden.status).toBe(200);
      expect((await api().get(`/api/v1/listings/${id}`).set(as('other'))).status).toBe(404);
      expect((await api().get(`/api/v1/listings/${id}`).set(as('buyer'))).status).toBe(200);
      expect((await api().get(`/api/v1/listings/${id}`).set(as('admin'))).status).toBe(200);
    });

    it('rate-limits listing creation per user', async () => {
      for (let i = 0; i < 5; i += 1) {
        expect((await api().post('/api/v1/listings').set(as('spammer')).send(validDraft())).status).toBe(201);
      }
      const res = await api().post('/api/v1/listings').set(as('spammer')).send(validDraft());
      expect(res.status).toBe(429);
      expect(res.body.error).toBe('LISTING_CREATE_RATE_LIMITED');
      // Other users are unaffected.
      expect((await api().post('/api/v1/listings').set(as('other')).send(validDraft())).status).toBe(201);
    });

    it('treats a malformed id as not found', async () => {
      const res = await api().get('/api/v1/listings/not-a-uuid');
      expect(res.status).toBe(404);
    });

    it('documents every listings endpoint in the OpenAPI spec', async () => {
      const spec = (await api().get('/api/docs-json')).body;
      expect(Object.keys(spec.paths)).toEqual(
        expect.arrayContaining([
          '/api/v1/listings',
          '/api/v1/listings/{id}',
          '/api/v1/listings/{id}/manage',
          '/api/v1/listings/{id}/publish',
          '/api/v1/listings/{id}/cancel',
          '/api/v1/me/listings',
          '/api/v1/auth/login',
        ]),
      );
    });
  });
});
