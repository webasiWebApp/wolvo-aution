import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AuthUser, isAdmin } from '../auth/auth-user';
import { badRequest, conflict, forbidden, notFound, unprocessable } from '../common/errors/app-error';
import { UserEntity } from '../users/user.entity';
import { CancelListingDto, CreateListingDto, UpdateListingDto } from './dto/listing-input.dto';
import { ListingStats, ManageListingDto, PublicListingDto, toManageListing, toPublicListing } from './dto/listing-response.dto';
import { AuctionEntity, AuctionStatus } from './entities/auction.entity';
import {
  ADMIN_ONLY_FIELDS,
  ALWAYS_EDITABLE_FIELDS,
  canView,
  isOwner,
  lockedFields,
  priceProblems,
  Problem,
  publishProblems,
  scheduleProblems,
  statusOnPublish,
} from './listing-rules';

const listingNotFound = () => notFound('LISTING_NOT_FOUND', 'Listing not found.');
const toDate = (value: string | null | undefined) => (value ? new Date(value) : null);

// Maps database constraint errors to clear API errors.
function mapDbError(error: unknown): never {
  if (error instanceof QueryFailedError) {
    const { code, constraint } = error.driverError as { code?: string; constraint?: string };
    if (code === '23505' && constraint === 'auctions_item_code_key') {
      throw conflict('ITEM_CODE_TAKEN', 'Another listing already uses this item code.');
    }
    if (code === '23503' && constraint?.includes('category_id')) {
      throw badRequest('INVALID_CATEGORY', 'Category does not exist.');
    }
  }
  throw error;
}

@Injectable()
export class ListingsService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly audit: AuditService,
  ) {}

  async create(user: AuthUser, dto: CreateListingDto): Promise<ManageListingDto> {
    if (!user.emailVerified) {
      throw forbidden('EMAIL_NOT_VERIFIED', 'Verify your email address before creating a listing.');
    }
    const listing = this.dataSource.getRepository(AuctionEntity).create({
      title: dto.title,
      description: dto.description ?? null,
      categoryId: dto.categoryId ?? null,
      condition: dto.condition ?? null,
      suburb: dto.suburb ?? null,
      state: dto.state ?? null,
      lotNumber: dto.lotNumber ?? null,
      sellerId: user.id,
      status: 'draft',
      startingBidCents: dto.startingBidCents,
      minIncrementCents: dto.minIncrementCents ?? 1000,
      reservePriceCents: dto.reservePriceCents ?? null,
      biddingType: dto.biddingType ?? 'online',
      startAt: toDate(dto.startAt),
      endAt: toDate(dto.endAt),
      viewingNotes: dto.viewingNotes ?? null,
      itemCode: dto.itemCode ?? null,
    });
    this.assertValid([
      ...priceProblems(listing),
      ...scheduleProblems(listing.startAt, listing.endAt, new Date(), { forPublish: false }),
    ]);

    try {
      const saved = await this.dataSource.getRepository(AuctionEntity).save(listing);
      return toManageListing(saved, { bidCount: 0, currentBidCents: null, imageCount: 0 });
    } catch (error) {
      mapDbError(error);
    }
  }

  async getPublic(id: string, user: AuthUser | null): Promise<PublicListingDto> {
    const manager = this.dataSource.manager;
    const listing = await manager.findOne(AuctionEntity, { where: { id } });
    if (!listing || !canView(listing, user)) throw listingNotFound();
    return toPublicListing(listing, await this.statsFor(manager, listing.id));
  }

  async getManage(id: string, user: AuthUser): Promise<ManageListingDto> {
    const manager = this.dataSource.manager;
    const listing = await manager.findOne(AuctionEntity, { where: { id } });
    this.assertManager(listing, user);
    return toManageListing(listing, await this.statsFor(manager, listing.id));
  }

  async listMine(user: AuthUser, status?: AuctionStatus): Promise<ManageListingDto[]> {
    const manager = this.dataSource.manager;
    const listings = await manager.find(AuctionEntity, {
      where: { sellerId: user.id, ...(status ? { status } : {}) },
      order: { createdAt: 'DESC' },
    });
    const stats = await this.statsMany(manager, listings.map((l) => l.id));
    return listings.map((l) => toManageListing(l, stats.get(l.id)!));
  }

  async update(id: string, user: AuthUser, dto: UpdateListingDto): Promise<ManageListingDto> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        // Row lock: a bid cannot land between the lock check and the update.
        const listing = await this.lockForChange(manager, id, user);
        const admin = isAdmin(user);
        const changed = Object.keys(dto).filter((key) => dto[key as keyof UpdateListingDto] !== undefined);
        if (changed.length === 0) throw badRequest('NO_CHANGES', 'Send at least one field to change.');

        const adminFields = changed.filter((f) => (ADMIN_ONLY_FIELDS as readonly string[]).includes(f));
        if (adminFields.length > 0 && !admin) {
          throw forbidden('ADMIN_ONLY_FIELDS', 'Only an admin can change these fields.', { fields: adminFields });
        }
        if (listing.status === 'closed' || listing.status === 'cancelled') {
          throw conflict('LISTING_NOT_EDITABLE', `A ${listing.status} listing cannot be edited.`);
        }

        const stats = await this.statsFor(manager, listing.id);
        const locked = lockedFields({ status: listing.status, bidCount: stats.bidCount }, changed);
        if (locked.length > 0) {
          throw conflict(
            'LISTING_FIELDS_LOCKED',
            `Bidding has started, so these fields can no longer be changed: ${locked.join(', ')}.`,
            {
              lockedFields: locked,
              editableFields: [...ALWAYS_EDITABLE_FIELDS, ...(admin ? ADMIN_ONLY_FIELDS : [])],
            },
          );
        }

        const before = toManageListing(listing, stats);
        this.apply(listing, dto);
        if (dto.auctioneerId) await this.assertAuctioneer(manager, dto.auctioneerId);

        const scheduleChanged = changed.includes('startAt') || changed.includes('endAt');
        this.assertValid([
          ...priceProblems(listing),
          ...scheduleProblems(listing.startAt, listing.endAt, new Date(), {
            // A published listing must keep a valid, future schedule.
            forPublish: listing.status === 'upcoming' && scheduleChanged,
          }),
        ]);

        const saved = await manager.save(listing);
        const after = toManageListing(saved, stats);
        if (admin) {
          await this.audit.record(manager, {
            actorId: user.id,
            action: 'listing.admin_update',
            entity: 'listing',
            entityId: listing.id,
            before: { ...before },
            after: { ...after },
          });
        }
        return after;
      });
    } catch (error) {
      mapDbError(error);
    }
  }

  async publish(id: string, user: AuthUser): Promise<ManageListingDto> {
    return this.dataSource.transaction(async (manager) => {
      const listing = await this.lockForChange(manager, id, user);
      if (!isOwner(listing, user)) {
        throw forbidden('NOT_LISTING_OWNER', 'Only the seller can publish this listing.');
      }
      if (listing.status !== 'draft') {
        throw conflict('LISTING_NOT_DRAFT', `Only a draft can be published; this listing is ${listing.status}.`);
      }

      const now = new Date();
      const stats = await this.statsFor(manager, listing.id);
      const problems = [...publishProblems(listing, stats.imageCount, now), ...priceProblems(listing)];
      if (problems.length > 0) {
        throw unprocessable('PUBLISH_REQUIREMENTS_NOT_MET', 'This listing is not ready to publish.', { problems });
      }

      const before = toManageListing(listing, stats);
      listing.status = statusOnPublish({ ...listing, startAt: listing.startAt! }, now);
      listing.publishedAt = now;
      const saved = await manager.save(listing);
      const after = toManageListing(saved, stats);
      await this.audit.record(manager, {
        actorId: user.id,
        action: 'listing.publish',
        entity: 'listing',
        entityId: listing.id,
        before: { ...before },
        after: { ...after },
      });
      return after;
    });
  }

  async cancel(id: string, user: AuthUser, dto: CancelListingDto): Promise<ManageListingDto> {
    return this.dataSource.transaction(async (manager) => {
      const listing = await this.lockForChange(manager, id, user);
      const admin = isAdmin(user);
      if (listing.status === 'cancelled') {
        throw conflict('LISTING_ALREADY_CANCELLED', 'This listing is already cancelled.');
      }

      const stats = await this.statsFor(manager, listing.id);
      if (admin) {
        if (!dto.reason) {
          throw badRequest('CANCEL_REASON_REQUIRED', 'An admin must give a reason to cancel a listing.');
        }
      } else {
        if (listing.status === 'closed') {
          throw conflict('LISTING_NOT_CANCELLABLE', 'A closed listing cannot be cancelled.');
        }
        if (stats.bidCount > 0) {
          throw conflict('LISTING_HAS_BIDS', 'A listing cannot be cancelled by the seller after the first bid.');
        }
      }

      const before = toManageListing(listing, stats);
      listing.status = 'cancelled';
      listing.cancelReason = dto.reason ?? null;
      const saved = await manager.save(listing);
      const after = toManageListing(saved, stats);
      await this.audit.record(manager, {
        actorId: user.id,
        action: admin ? 'listing.admin_cancel' : 'listing.cancel',
        entity: 'listing',
        entityId: listing.id,
        before: { ...before },
        after: { ...after },
      });
      return after;
    });
  }

  // Locks the row and checks the caller may change it. Listings the caller
  // cannot see are 404; visible ones they do not own are 403.
  private async lockForChange(manager: EntityManager, id: string, user: AuthUser): Promise<AuctionEntity> {
    const listing = await manager.findOne(AuctionEntity, { where: { id }, lock: { mode: 'pessimistic_write' } });
    this.assertManager(listing, user);
    return listing;
  }

  private assertManager(listing: AuctionEntity | null, user: AuthUser): asserts listing is AuctionEntity {
    if (!listing || !canView(listing, user)) throw listingNotFound();
    if (!isAdmin(user) && !isOwner(listing, user)) {
      throw forbidden('NOT_LISTING_OWNER', 'Only the seller or an admin can manage this listing.');
    }
  }

  private assertValid(problems: Problem[]): void {
    if (problems.length > 0) {
      throw unprocessable('LISTING_INVALID', 'Some listing fields are invalid.', { problems });
    }
  }

  private async assertAuctioneer(manager: EntityManager, userId: string): Promise<void> {
    const user = await manager.findOne(UserEntity, { where: { id: userId } });
    if (!user || user.role !== 'auctioneer') {
      throw badRequest('INVALID_AUCTIONEER', 'auctioneerId must belong to a user with the auctioneer role.');
    }
  }

  private apply(listing: AuctionEntity, dto: UpdateListingDto): void {
    const { startAt, endAt, ...rest } = dto;
    for (const [key, value] of Object.entries(rest)) {
      if (value !== undefined) (listing as unknown as Record<string, unknown>)[key] = value;
    }
    if (startAt !== undefined) listing.startAt = toDate(startAt);
    if (endAt !== undefined) listing.endAt = toDate(endAt);
  }

  private async statsFor(manager: EntityManager, id: string): Promise<ListingStats> {
    return (await this.statsMany(manager, [id])).get(id)!;
  }

  private async statsMany(manager: EntityManager, ids: string[]): Promise<Map<string, ListingStats>> {
    const result = new Map<string, ListingStats>();
    if (ids.length === 0) return result;
    const rows: { id: string; bid_count: number; current_bid: number | null; image_count: number }[] =
      await manager.query(
        `SELECT a.id,
                (SELECT count(*)::int FROM bids b WHERE b.auction_id = a.id) AS bid_count,
                (SELECT max(b.amount_cents) FROM bids b WHERE b.auction_id = a.id) AS current_bid,
                (SELECT count(*)::int FROM auction_images i WHERE i.auction_id = a.id) AS image_count
           FROM auctions a
          WHERE a.id = ANY($1::uuid[])`,
        [ids],
      );
    for (const row of rows) {
      result.set(row.id, {
        bidCount: row.bid_count,
        currentBidCents: row.current_bid,
        imageCount: row.image_count,
      });
    }
    return result;
  }
}
