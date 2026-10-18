import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../config/database.config';

// Used by the TypeORM CLI (npm run migration:*).
export default new DataSource(buildDataSourceOptions());
