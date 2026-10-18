import { MigrationInterface, QueryRunner } from 'typeorm';

// M1 foundation: the users, categories, auctions and bids tables that M2 builds
// on. These were missing from the repository, so they are created here as the
// baseline. Marketplace columns on auctions are added by the M2 migration.
export class M1Foundation1792281600000 implements MigrationInterface {
  name = 'M1Foundation1792281600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS citext`);

    await queryRunner.query(
      `CREATE TYPE user_role AS ENUM ('user', 'auctioneer', 'moderator', 'admin')`,
    );
    await queryRunner.query(`
      CREATE TABLE users (
        id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email             citext NOT NULL,
        password_hash     text NOT NULL,
        display_name      text NOT NULL,
        role              user_role NOT NULL DEFAULT 'user',
        email_verified_at timestamptz,
        created_at        timestamptz NOT NULL DEFAULT now(),
        updated_at        timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT users_email_key UNIQUE (email)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE categories (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name        text NOT NULL,
        slug        text NOT NULL,
        description text,
        icon        text,
        sort_order  integer NOT NULL DEFAULT 0,
        is_active   boolean NOT NULL DEFAULT true,
        created_at  timestamptz NOT NULL DEFAULT now(),
        updated_at  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT categories_slug_key UNIQUE (slug)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE auctions (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title      text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE TYPE bid_source AS ENUM ('online', 'physical')`);
    await queryRunner.query(`
      CREATE TABLE bids (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        auction_id   uuid NOT NULL REFERENCES auctions (id) ON DELETE RESTRICT,
        bidder_id    uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
        amount_cents integer NOT NULL,
        source       bid_source NOT NULL DEFAULT 'online',
        created_at   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT bids_amount_positive CHECK (amount_cents > 0),
        CONSTRAINT bids_auction_amount_key UNIQUE (auction_id, amount_cents)
      )
    `);
    await queryRunner.query(`CREATE INDEX bids_bidder_id_idx ON bids (bidder_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE bids`);
    await queryRunner.query(`DROP TYPE bid_source`);
    await queryRunner.query(`DROP TABLE auctions`);
    await queryRunner.query(`DROP TABLE categories`);
    await queryRunner.query(`DROP TABLE users`);
    await queryRunner.query(`DROP TYPE user_role`);
  }
}
