import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// Opens upcoming listings at start_at and closes open ones at end_at.
// Each transition is one conditional UPDATE, so overlapping runs (or several
// app instances) cannot move a listing twice. Winner settlement belongs to
// the bidding module and is not done here.
@Injectable()
export class ListingLifecycleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ListingLifecycleService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (this.config.get('SCHEDULER_ENABLED') === 'false') return;
    const intervalMs = Number(this.config.get('SCHEDULER_INTERVAL_MS') ?? 60_000);
    this.timer = setInterval(() => void this.tick(), intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now = new Date()): Promise<void> {
    try {
      await this.openDue(now);
      await this.closeDue(now);
    } catch (error) {
      this.logger.error(error instanceof Error ? error.stack : String(error));
    }
  }

  // Physical and hybrid listings stay upcoming until an auctioneer is assigned.
  async openDue(now = new Date()): Promise<string[]> {
    const [rows] = await this.dataSource.query(
      `UPDATE auctions SET status = 'open', updated_at = now()
        WHERE status = 'upcoming' AND start_at <= $1
          AND (bidding_type = 'online' OR auctioneer_id IS NOT NULL)
        RETURNING id`,
      [now],
    );
    return (rows as { id: string }[]).map((r) => r.id);
  }

  async closeDue(now = new Date()): Promise<string[]> {
    const [rows] = await this.dataSource.query(
      `UPDATE auctions SET status = 'closed', updated_at = now()
        WHERE status = 'open' AND end_at <= $1
        RETURNING id`,
      [now],
    );
    return (rows as { id: string }[]).map((r) => r.id);
  }
}
