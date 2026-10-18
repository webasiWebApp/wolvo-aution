import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AUCTION_STATUSES } from '../entities/auction.entity';
import { IfPresent, ListingFieldsDto, MAX_CENTS } from './listing-fields.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateListingDto extends ListingFieldsDto {
  @ApiProperty({ minLength: 3, maxLength: 200, example: 'Mid-century teak sideboard' })
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ description: 'Starting bid in cents (AUD).', minimum: 1, example: 40000 })
  @IsInt()
  @Min(1)
  @Max(MAX_CENTS)
  startingBidCents!: number;
}

export class UpdateListingDto extends ListingFieldsDto {
  @ApiPropertyOptional({ minLength: 3, maxLength: 200 })
  @IfPresent()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ description: 'Starting bid in cents (AUD).', minimum: 1 })
  @IfPresent()
  @IsInt()
  @Min(1)
  @Max(MAX_CENTS)
  startingBidCents?: number;

  @ApiPropertyOptional({ nullable: true, format: 'uuid', description: 'Admin only. Must be an auctioneer.' })
  @IsOptional()
  @IsUUID()
  auctioneerId?: string | null;

  @ApiPropertyOptional({ description: 'Admin only.' })
  @IfPresent()
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ description: 'Admin only. Hides the listing from the public (moderation).' })
  @IfPresent()
  @IsBoolean()
  isHidden?: boolean;
}

export class CancelListingDto {
  @ApiPropertyOptional({ maxLength: 500, description: 'Required when an admin cancels.' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason?: string;
}

export class MyListingsQueryDto {
  @ApiPropertyOptional({ enum: AUCTION_STATUSES })
  @IsOptional()
  @IsIn(AUCTION_STATUSES)
  status?: (typeof AUCTION_STATUSES)[number];
}
