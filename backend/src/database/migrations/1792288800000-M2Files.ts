import { MigrationInterface, QueryRunner } from 'typeorm';

// Metadata for every stored file. The bytes live in the storage driver under
// storage_key; rows are soft-deleted (deleted_at) when a file is removed.
export class M2Files1792288800000 implements MigrationInterface {
  name = 'M2Files1792288800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE file_visibility AS ENUM ('public', 'private')`);
    await queryRunner.query(`
      CREATE TABLE files (
        id          uuid PRIMARY KEY,
        owner_id    uuid REFERENCES users (id) ON DELETE SET NULL,
        purpose     text NOT NULL,
        visibility  file_visibility NOT NULL DEFAULT 'private',
        mime_type   text NOT NULL,
        size_bytes  integer NOT NULL,
        sha256      char(64) NOT NULL,
        driver      text NOT NULL,
        storage_key text NOT NULL,
        created_at  timestamptz NOT NULL DEFAULT now(),
        deleted_at  timestamptz,
        CONSTRAINT files_storage_key_key UNIQUE (storage_key),
        CONSTRAINT files_size_positive CHECK (size_bytes > 0)
      )
    `);
    await queryRunner.query(`CREATE INDEX files_owner_id_idx ON files (owner_id)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE files`);
    await queryRunner.query(`DROP TYPE file_visibility`);
  }
}
