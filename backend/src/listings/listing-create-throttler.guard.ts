import { HttpStatus, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppError } from '../common/errors/app-error';

// Rate-limits listing creation per signed-in user (falls back to IP).
// Limits come from ThrottlerModule (LISTING_CREATE_LIMIT per LISTING_CREATE_TTL_MS).
// The counter is in memory, so it is per app instance.
@Injectable()
export class ListingCreateThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as { id?: string } | undefined;
    return user?.id ?? String(req.ip);
  }

  protected override async throwThrottlingException(): Promise<void> {
    throw new AppError(
      HttpStatus.TOO_MANY_REQUESTS,
      'LISTING_CREATE_RATE_LIMITED',
      'You are creating listings too quickly. Please try again later.',
    );
  }
}
