import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AU_STATES,
  AUCTION_STATUSES,
  AuctionEntity,
  BIDDING_TYPES,
  ITEM_CONDITIONS,
} from '../entities/auction.entity';
import { reserveStatus, ReserveStatus } from '../listing-rules';

export interface ListingStats {
  bidCount: number;
  currentBidCents: number | null;
  imageCount: number;
}

// Public view. Never includes the reserve amount or moderation fields.
export class PublicListingDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiPropertyOptional({ nullable: true }) description!: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'uuid' }) categoryId!: string | null;
  @ApiPropertyOptional({ nullable: true, enum: ITEM_CONDITIONS }) condition!: string | null;
  @ApiPropertyOptional({ nullable: true }) suburb!: string | null;
  @ApiPropertyOptional({ nullable: true, enum: AU_STATES }) state!: string | null;
  @ApiPropertyOptional({ nullable: true }) lotNumber!: string | null;
  @ApiProperty({ enum: AUCTION_STATUSES }) status!: string;
  @ApiProperty({ enum: BIDDING_TYPES }) biddingType!: string;
  @ApiProperty() featured!: boolean;
  @ApiProperty({ description: 'Cents (AUD).' }) startingBidCents!: number;
  @ApiProperty({ description: 'Cents (AUD).' }) minIncrementCents!: number;
  @ApiPropertyOptional({ nullable: true, description: 'Cents (AUD).' }) currentBidCents!: number | null;
  @ApiProperty() bidCount!: number;
  @ApiProperty({ enum: ['none', 'not_met', 'met'] }) reserveStatus!: ReserveStatus;
  @ApiProperty() imageCount!: number;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' }) startAt!: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' }) endAt!: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' }) publishedAt!: string | null;
  @ApiPropertyOptional({ nullable: true }) viewingNotes!: string | null;
  @ApiPropertyOptional({ nullable: true }) itemCode!: string | null;
}

// Owner and admin view, including private fields.
export class ManageListingDto extends PublicListingDto {
  @ApiProperty({ format: 'uuid' }) sellerId!: string;
  @ApiPropertyOptional({ nullable: true, format: 'uuid' }) auctioneerId!: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Private. Cents (AUD).' }) reservePriceCents!: number | null;
  @ApiProperty() isHidden!: boolean;
  @ApiPropertyOptional({ nullable: true }) cancelReason!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

const iso = (date: Date | null) => (date ? date.toISOString() : null);

export function toPublicListing(a: AuctionEntity, stats: ListingStats): PublicListingDto {
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    categoryId: a.categoryId,
    condition: a.condition,
    suburb: a.suburb,
    state: a.state,
    lotNumber: a.lotNumber,
    status: a.status,
    biddingType: a.biddingType,
    featured: a.featured,
    startingBidCents: a.startingBidCents,
    minIncrementCents: a.minIncrementCents,
    currentBidCents: stats.currentBidCents,
    bidCount: stats.bidCount,
    reserveStatus: reserveStatus(a.reservePriceCents, stats.currentBidCents),
    imageCount: stats.imageCount,
    startAt: iso(a.startAt),
    endAt: iso(a.endAt),
    publishedAt: iso(a.publishedAt),
    viewingNotes: a.viewingNotes,
    itemCode: a.itemCode,
  };
}

export function toManageListing(a: AuctionEntity, stats: ListingStats): ManageListingDto {
  return {
    ...toPublicListing(a, stats),
    sellerId: a.sellerId,
    auctioneerId: a.auctioneerId,
    reservePriceCents: a.reservePriceCents,
    isHidden: a.isHidden,
    cancelReason: a.cancelReason,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
}
