import { MigrationInterface, QueryRunner } from 'typeorm';

// M2 marketplace core. Adds the listing columns M1 lacks (M1 auctions only has
// id, title and timestamps), plus auction_images, watchlist and audit_log.
// Money is integer cents (AUD); timestamps are timestamptz (UTC).
export class M2MarketplaceCore1792285200000 implements MigrationInterface {
  name = 'M2MarketplaceCore1792285200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE auction_status AS ENUM ('draft', 'upcoming', 'open', 'closed', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE au_state AS ENUM ('NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT')`,
    );
    await queryRunner.query(`
      CREATE TYPE item_condition AS ENUM (
        'new', 'used_like_new', 'used_good', 'used_fair', 'for_parts_or_repair', 'antique_collectable'
      )
    `);
    await queryRunner.query(`CREATE TYPE bidding_type AS ENUM ('online', 'physical', 'hybrid')`);

    // title already exists from M1.
    await queryRunner.query(`
      ALTER TABLE auctions
        ADD COLUMN seller_id           uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
        ADD COLUMN auctioneer_id       uuid REFERENCES users (id) ON DELETE SET NULL,
        ADD COLUMN status              auction_status NOT NULL DEFAULT 'draft',
        ADD COLUMN is_hidden           boolean NOT NULL DEFAULT false,
        ADD COLUMN featured            boolean NOT NULL DEFAULT false,
        ADD COLUMN cancel_reason       text,
        ADD COLUMN published_at        timestamptz,
        ADD COLUMN description         text,
        ADD COLUMN category_id         uuid REFERENCES categories (id) ON DELETE RESTRICT,
        ADD COLUMN condition           item_condition,
        ADD COLUMN suburb              text,
        ADD COLUMN state               au_state,
        ADD COLUMN lot_number          text,
        ADD COLUMN starting_bid_cents  integer NOT NULL,
        ADD COLUMN min_increment_cents integer NOT NULL DEFAULT 1000,
        ADD COLUMN reserve_price_cents integer,
        ADD COLUMN bidding_type        bidding_type NOT NULL DEFAULT 'online',
        ADD COLUMN start_at            timestamptz,
        ADD COLUMN end_at              timestamptz,
        ADD COLUMN viewing_notes       text,
        ADD COLUMN item_code           text,
        ADD CONSTRAINT auctions_starting_bid_positive CHECK (starting_bid_cents > 0),
        ADD CONSTRAINT auctions_min_increment_positive CHECK (min_increment_cents > 0),
        ADD CONSTRAINT auctions_reserve_valid
          CHECK (reserve_price_cents IS NULL OR reserve_price_cents >= starting_bid_cents),
        ADD CONSTRAINT auctions_end_after_start CHECK (end_at > start_at)
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX auctions_item_code_key ON auctions (item_code) WHERE item_code IS NOT NULL`,
    );
    await queryRunner.query(`CREATE INDEX auctions_seller_status_idx ON auctions (seller_id, status)`);
    await queryRunner.query(`CREATE INDEX auctions_status_end_at_idx ON auctions (status, end_at)`);
    await queryRunner.query(`CREATE INDEX auctions_is_hidden_idx ON auctions (is_hidden)`);

    await queryRunner.query(`
      CREATE TABLE auction_images (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        auction_id  uuid NOT NULL REFERENCES auctions (id) ON DELETE CASCADE,
        storage_key text NOT NULL,
        thumb_key   text,
        width       integer,
        height      integer,
        position    integer NOT NULL DEFAULT 0,
        created_at  timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT auction_images_storage_key_key UNIQUE (storage_key),
        CONSTRAINT auction_images_width_positive CHECK (width IS NULL OR width > 0),
        CONSTRAINT auction_images_height_positive CHECK (height IS NULL OR height > 0),
        CONSTRAINT auction_images_position_non_negative CHECK (position >= 0)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX auction_images_auction_position_idx ON auction_images (auction_id, position)`,
    );

    await queryRunner.query(`
      CREATE TABLE watchlist (
        user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        auction_id uuid NOT NULL REFERENCES auctions (id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        -- The primary key is the unique (user_id, auction_id) rule.
        CONSTRAINT watchlist_pkey PRIMARY KEY (user_id, auction_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE audit_log (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id   uuid REFERENCES users (id) ON DELETE SET NULL,
        action     text NOT NULL,
        entity     text NOT NULL,
        entity_id  text NOT NULL,
        before     jsonb,
        after      jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE audit_log`);
    await queryRunner.query(`DROP TABLE watchlist`);
    await queryRunner.query(`DROP TABLE auction_images`);
    await queryRunner.query(`DROP INDEX auctions_is_hidden_idx`);
    await queryRunner.query(`DROP INDEX auctions_status_end_at_idx`);
    await queryRunner.query(`DROP INDEX auctions_seller_status_idx`);
    await queryRunner.query(`DROP INDEX auctions_item_code_key`);
    await queryRunner.query(`
      ALTER TABLE auctions
        DROP CONSTRAINT auctions_end_after_start,
        DROP CONSTRAINT auctions_reserve_valid,
        DROP CONSTRAINT auctions_min_increment_positive,
        DROP CONSTRAINT auctions_starting_bid_positive,
        DROP COLUMN item_code,
        DROP COLUMN viewing_notes,
        DROP COLUMN end_at,
        DROP COLUMN start_at,
        DROP COLUMN bidding_type,
        DROP COLUMN reserve_price_cents,
        DROP COLUMN min_increment_cents,
        DROP COLUMN starting_bid_cents,
        DROP COLUMN lot_number,
        DROP COLUMN state,
        DROP COLUMN suburb,
        DROP COLUMN condition,
        DROP COLUMN category_id,
        DROP COLUMN description,
        DROP COLUMN published_at,
        DROP COLUMN cancel_reason,
        DROP COLUMN featured,
        DROP COLUMN is_hidden,
        DROP COLUMN status,
        DROP COLUMN auctioneer_id,
        DROP COLUMN seller_id
    `);
    await queryRunner.query(`DROP TYPE bidding_type`);
    await queryRunner.query(`DROP TYPE item_condition`);
    await queryRunner.query(`DROP TYPE au_state`);
    await queryRunner.query(`DROP TYPE auction_status`);
  }
}
