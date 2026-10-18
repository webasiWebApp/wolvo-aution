import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Read-only here; bids are placed by the bidding module.
@Entity('bids')
export class BidEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'auction_id', type: 'uuid' })
  auctionId!: string;

  @Column({ name: 'bidder_id', type: 'uuid' })
  bidderId!: string;

  @Column({ name: 'amount_cents', type: 'integer' })
  amountCents!: number;

  @Column({ type: 'enum', enum: ['online', 'physical'], enumName: 'bid_source', default: 'online' })
  source!: 'online' | 'physical';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
