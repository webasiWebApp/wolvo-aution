// TEST DATA ONLY. Loads the test seed into DB_DATABASE (npm run seed:test).
import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../../config/database.config';
import { seedTestData } from './test-seed';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to load test data with NODE_ENV=production.');
  }

  const dataSource = new DataSource(buildDataSourceOptions());
  await dataSource.initialize();
  try {
    const summary = await seedTestData(dataSource);
    console.log(`Test seed loaded into "${process.env.DB_DATABASE}":`, summary);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
