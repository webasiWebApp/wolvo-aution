import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { AuctionImageEntity } from './entities/auction-image.entity';
import { AuctionEntity } from './entities/auction.entity';
import { BidEntity } from './entities/bid.entity';
import { ListingCreateThrottlerGuard } from './listing-create-throttler.guard';
import { ListingLifecycleService } from './listing-lifecycle.service';
import { ListingsController, MyListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AuctionEntity, AuctionImageEntity, BidEntity]),
    AuditModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'listing-create',
          limit: Number(config.get('LISTING_CREATE_LIMIT') ?? 10),
          ttl: Number(config.get('LISTING_CREATE_TTL_MS') ?? 60 * 60 * 1000),
        },
      ],
    }),
  ],
  controllers: [ListingsController, MyListingsController],
  providers: [ListingsService, ListingLifecycleService, ListingCreateThrottlerGuard],
  exports: [ListingLifecycleService],
})
export class ListingsModule {}
