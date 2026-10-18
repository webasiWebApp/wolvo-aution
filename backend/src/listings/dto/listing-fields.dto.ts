import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { AU_STATES, BIDDING_TYPES, ITEM_CONDITIONS } from '../entities/auction.entity';

export const MAX_CENTS = 2_000_000_000;

// Validates whenever the field is sent, so an explicit null is rejected for
// columns that cannot be null. Nullable fields use @IsOptional() instead.
export const IfPresent = () => ValidateIf((_object, value) => value !== undefined);

// Fields shared by create and update. title and startingBidCents are declared
// on each DTO because they are required on create and optional on update.
export class ListingFieldsDto {
  @ApiPropertyOptional({ nullable: true, maxLength: 10000 })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  description?: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @ApiPropertyOptional({ nullable: true, enum: ITEM_CONDITIONS })
  @IsOptional()
  @IsIn(ITEM_CONDITIONS)
  condition?: (typeof ITEM_CONDITIONS)[number] | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  suburb?: string | null;

  @ApiPropertyOptional({ nullable: true, enum: AU_STATES })
  @IsOptional()
  @IsIn(AU_STATES)
  state?: (typeof AU_STATES)[number] | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  lotNumber?: string | null;

  @ApiPropertyOptional({ description: 'Minimum bid increment in cents (AUD).', minimum: 1, default: 1000 })
  @IfPresent()
  @IsInt()
  @Min(1)
  @Max(MAX_CENTS)
  minIncrementCents?: number;

  @ApiPropertyOptional({ nullable: true, description: 'Private reserve in cents (AUD). Never shown publicly.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_CENTS)
  reservePriceCents?: number | null;

  @ApiPropertyOptional({ enum: BIDDING_TYPES, default: 'online' })
  @IfPresent()
  @IsIn(BIDDING_TYPES)
  biddingType?: (typeof BIDDING_TYPES)[number];

  @ApiPropertyOptional({ nullable: true, format: 'date-time', description: 'UTC ISO-8601.' })
  @IsOptional()
  @IsISO8601({ strict: true })
  startAt?: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date-time', description: 'UTC ISO-8601.' })
  @IsOptional()
  @IsISO8601({ strict: true })
  endAt?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  viewingNotes?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Permanent physical item code.', example: 'WLV-000123' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9-]{1,64}$/, { message: 'itemCode may contain letters, digits and dashes (max 64).' })
  itemCode?: string | null;
}
