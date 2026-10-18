import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AuditLogEntity } from './audit-log.entity';

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  // Takes the caller's EntityManager so the entry commits or rolls back with
  // the change it records.
  async record(manager: EntityManager, entry: AuditEntry): Promise<void> {
    // Built as an entity so TypeORM serialises the jsonb columns.
    const row = manager.create(AuditLogEntity, {
      actorId: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      before: entry.before ?? null,
      after: entry.after ?? null,
    });
    await manager.save(row);
  }
}
