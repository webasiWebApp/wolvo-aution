import 'dotenv/config';
import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtemp, readdir, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Client } from 'pg';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { StorageService } from '../src/storage/storage.service';

// Real PostgreSQL files table + local disk driver in a temp folder.
const testDb = `${process.env.DB_TEST_DATABASE ?? 'wolvo_test'}_storage`;

async function adminQuery(sql: string): Promise<void> {
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

describe('Storage (e2e, real PostgreSQL)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let storage: StorageService;
  let root: string;

  beforeAll(async () => {
    await adminQuery(`DROP DATABASE IF EXISTS "${testDb}" WITH (FORCE)`);
    await adminQuery(`CREATE DATABASE "${testDb}"`);
    root = await mkdtemp(join(tmpdir(), 'wolvo-e2e-storage-'));
    Object.assign(process.env, {
      DB_DATABASE: testDb,
      JWT_SECRET: 'e2e-test-secret-not-for-production',
      SCHEDULER_ENABLED: 'false',
      STORAGE_DRIVER: 'local',
      STORAGE_LOCAL_PATH: root,
      STORAGE_SIGNING_SECRET: 'e2e-storage-signing-secret-0123456789',
      STORAGE_MAX_FILE_MB: '1',
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    ds = app.get(DataSource);
    await ds.runMigrations({ transaction: 'each' });
    storage = app.get(StorageService);
  });

  afterAll(async () => {
    await app?.close();
    await adminQuery(`DROP DATABASE IF EXISTS "${testDb}" WITH (FORCE)`);
    await rm(root, { recursive: true, force: true });
  });

  it('stores bytes under a UUID key and records them in the files table', async () => {
    const info = await storage.save(Buffer.from('jpeg-bytes'), {
      ownerId: null,
      purpose: 'listing_photo',
      visibility: 'public',
      mimeType: 'image/jpeg',
    });
    const [row] = await ds.query(`SELECT size_bytes, sha256, storage_key, driver FROM files WHERE id = $1`, [info.id]);
    expect(row).toMatchObject({ size_bytes: 10, sha256: info.sha256, driver: 'local' });
    expect(row.storage_key).toBe(`${info.id.slice(0, 2)}/${info.id}`);
    expect(await readdir(join(root, info.id.slice(0, 2)))).toEqual([info.id]);

    const res = await request(app.getHttpServer()).get(await storage.getUrl(info.id));
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('immutable');
    expect(res.body.toString()).toBe('jpeg-bytes');
  });

  it('serves private files only through a valid signed link', async () => {
    const info = await storage.save(Buffer.from('id-document'), {
      ownerId: null,
      purpose: 'verification',
      visibility: 'private',
      mimeType: 'application/pdf',
    });
    const server = app.getHttpServer();
    expect((await request(server).get(`/api/v1/files/${info.id}`)).status).toBe(404);
    expect((await request(server).get(await storage.getUrl(info.id))).status).toBe(200);
  });

  it('soft-deletes on remove and then returns 404', async () => {
    const info = await storage.save(Buffer.from('bye'), {
      ownerId: null,
      purpose: 'listing_photo',
      visibility: 'public',
      mimeType: 'image/png',
    });
    await storage.remove(info.id);
    const [row] = await ds.query(`SELECT deleted_at FROM files WHERE id = $1`, [info.id]);
    expect(row.deleted_at).toBeInstanceOf(Date);
    expect((await request(app.getHttpServer()).get(`/api/v1/files/${info.id}`)).status).toBe(404);
  });

  it('enforces STORAGE_MAX_FILE_MB', async () => {
    const tooBig = Buffer.alloc(1024 * 1024 + 1, 1);
    await expect(
      storage.save(tooBig, { ownerId: null, purpose: 'listing_photo', visibility: 'public', mimeType: 'image/png' }),
    ).rejects.toMatchObject({ status: 413 });
  });

  it('refuses to start with an unknown STORAGE_DRIVER', async () => {
    process.env.STORAGE_DRIVER = 'carrier-pigeon';
    try {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile().catch((e: Error) => e);
      expect(moduleRef).toBeInstanceOf(Error);
      expect((moduleRef as Error).message).toContain('Unknown STORAGE_DRIVER "carrier-pigeon"');
    } finally {
      process.env.STORAGE_DRIVER = 'local';
    }
  });
});
