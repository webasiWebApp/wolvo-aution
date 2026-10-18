import { join } from 'path';
import { DataSourceOptions } from 'typeorm';

// Builds TypeORM options from DB_* environment variables. Shared by the Nest
// app, the migration CLI, the seed script and the e2e tests.
export function buildDataSourceOptions(
  env: NodeJS.ProcessEnv = process.env,
  overrides: Partial<{ database: string }> = {},
): DataSourceOptions {
  const required = ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_PASSWORD', 'DB_DATABASE'];
  const missing = required.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing database configuration: ${missing.join(', ')}`);
  }

  return {
    type: 'postgres',
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    username: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: overrides.database ?? env.DB_DATABASE,
    entities: [],
    migrations: [join(__dirname, '..', 'database', 'migrations', '*.{ts,js}')],
    migrationsTableName: 'migrations',
    // Schema changes only through migrations.
    synchronize: false,
    migrationsRun: false,
  };
}
