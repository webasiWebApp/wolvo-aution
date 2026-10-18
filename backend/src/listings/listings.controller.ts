import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser, Public } from '../auth/decorators/auth.decorators';
import { notFound } from '../common/errors/app-error';
import { CancelListingDto, CreateListingDto, MyListingsQueryDto, UpdateListingDto } from './dto/listing-input.dto';
import { ManageListingDto, PublicListingDto } from './dto/listing-response.dto';
import { ListingCreateThrottlerGuard } from './listing-create-throttler.guard';
import { ListingsService } from './listings.service';

// A malformed id cannot exist, so it is a 404 like any unknown listing.
const ListingId = () =>
  new ParseUUIDPipe({ exceptionFactory: () => notFound('LISTING_NOT_FOUND', 'Listing not found.') });

@ApiTags('listings')
@ApiBearerAuth()
@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Post()
  @UseGuards(ListingCreateThrottlerGuard)
  @ApiCreatedResponse({ type: ManageListingDto, description: 'Draft created; the caller is the seller.' })
  @ApiForbiddenResponse({ description: 'EMAIL_NOT_VERIFIED' })
  @ApiTooManyRequestsResponse({ description: 'LISTING_CREATE_RATE_LIMITED' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateListingDto): Promise<ManageListingDto> {
    return this.listings.create(user, dto);
  }

  @Public()
  @Get(':id')
  @ApiOkResponse({ type: PublicListingDto, description: 'Public view; never includes the reserve.' })
  @ApiNotFoundResponse({ description: 'Unknown, or a draft/cancelled/hidden listing you do not own.' })
  getPublic(@Param('id', ListingId()) id: string, @CurrentUser() user: AuthUser | null): Promise<PublicListingDto> {
    return this.listings.getPublic(id, user);
  }

  @Get(':id/manage')
  @ApiOkResponse({ type: ManageListingDto, description: 'Owner or admin; includes private fields.' })
  @ApiForbiddenResponse({ description: 'NOT_LISTING_OWNER' })
  @ApiNotFoundResponse({ description: 'LISTING_NOT_FOUND' })
  getManage(@Param('id', ListingId()) id: string, @CurrentUser() user: AuthUser): Promise<ManageListingDto> {
    return this.listings.getManage(id, user);
  }

  @Patch(':id')
  @ApiOkResponse({ type: ManageListingDto })
  @ApiForbiddenResponse({ description: 'NOT_LISTING_OWNER, ADMIN_ONLY_FIELDS' })
  @ApiConflictResponse({ description: 'LISTING_FIELDS_LOCKED (details.lockedFields), LISTING_NOT_EDITABLE' })
  @ApiUnprocessableEntityResponse({ description: 'LISTING_INVALID (details.problems)' })
  update(
    @Param('id', ListingId()) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateListingDto,
  ): Promise<ManageListingDto> {
    return this.listings.update(id, user, dto);
  }

  @Post(':id/publish')
  @HttpCode(200)
  @ApiOkResponse({ type: ManageListingDto, description: 'Status becomes upcoming (or open).' })
  @ApiForbiddenResponse({ description: 'NOT_LISTING_OWNER' })
  @ApiConflictResponse({ description: 'LISTING_NOT_DRAFT' })
  @ApiUnprocessableEntityResponse({ description: 'PUBLISH_REQUIREMENTS_NOT_MET (details.problems)' })
  publish(@Param('id', ListingId()) id: string, @CurrentUser() user: AuthUser): Promise<ManageListingDto> {
    return this.listings.publish(id, user);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOkResponse({ type: ManageListingDto })
  @ApiConflictResponse({ description: 'LISTING_HAS_BIDS, LISTING_ALREADY_CANCELLED, LISTING_NOT_CANCELLABLE' })
  cancel(
    @Param('id', ListingId()) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CancelListingDto,
  ): Promise<ManageListingDto> {
    return this.listings.cancel(id, user, dto);
  }
}

@ApiTags('listings')
@ApiBearerAuth()
@Controller('me/listings')
export class MyListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  @ApiOkResponse({ type: [ManageListingDto], description: 'Your listings with bid count, current bid and reserve status.' })
  list(@CurrentUser() user: AuthUser, @Query() query: MyListingsQueryDto): Promise<ManageListingDto[]> {
    return this.listings.listMine(user, query.status);
  }
}
