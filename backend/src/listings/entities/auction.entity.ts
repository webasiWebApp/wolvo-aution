import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const AUCTION_STATUSES = ['draft', 'upcoming', 'open', 'closed', 'cancelled'] as const;
export type AuctionStatus = (typeof AUCTION_STATUSES)[number];

export const AU_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const;
export type AuState = (typeof AU_STATES)[number];

export const ITEM_CONDITIONS = [
  'new',
  'used_like_new',
  'used_good',
  'used_fair',
  'for_parts_or_repair',
  'antique_collectable',
] as const;
export type ItemCondition = (typeof ITEM_CONDITIONS)[number];

export const BIDDING_TYPES = ['online', 'physical', 'hybrid'] as const;
export type BiddingType = (typeof BIDDING_TYPES)[number];

// A listing. Money is integer cents (AUD); times are timestamptz (UTC).
@Entity('auctions')
export class AuctionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId!: string | null;

  @Column({ type: 'enum', enum: ITEM_CONDITIONS, enumName: 'item_condition', nullable: true })
  condition!: ItemCondition | null;

  @Column({ type: 'text', nullable: true })
  suburb!: string | null;

  @Column({ type: 'enum', enum: AU_STATES, enumName: 'au_state', nullable: true })
  state!: AuState | null;

  @Column({ name: 'lot_number', type: 'text', nullable: true })
  lotNumber!: string | null;

  @Column({ name: 'seller_id', type: 'uuid' })
  sellerId!: string;

  @Column({ name: 'auctioneer_id', type: 'uuid', nullable: true })
  auctioneerId!: string | null;

  @Column({ type: 'enum', enum: AUCTION_STATUSES, enumName: 'auction_status', default: 'draft' })
  status!: AuctionStatus;

  @Column({ name: 'is_hidden', type: 'boolean', default: false })
  isHidden!: boolean;

  @Column({ type: 'boolean', default: false })
  featured!: boolean;

  @Column({ name: 'cancel_reason', type: 'text', nullable: true })
  cancelReason!: string | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ name: 'starting_bid_cents', type: 'integer' })
  startingBidCents!: number;

  @Column({ name: 'min_increment_cents', type: 'integer', default: 1000 })
  minIncrementCents!: number;

  @Column({ name: 'reserve_price_cents', type: 'integer', nullable: true })
  reservePriceCents!: number | null;

  @Column({ name: 'bidding_type', type: 'enum', enum: BIDDING_TYPES, enumName: 'bidding_type', default: 'online' })
  biddingType!: BiddingType;

  @Column({ name: 'start_at', type: 'timestamptz', nullable: true })
  startAt!: Date | null;

  @Column({ name: 'end_at', type: 'timestamptz', nullable: true })
  endAt!: Date | null;

  @Column({ name: 'viewing_notes', type: 'text', nullable: true })
  viewingNotes!: string | null;

  @Column({ name: 'item_code', type: 'text', nullable: true })
  itemCode!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
