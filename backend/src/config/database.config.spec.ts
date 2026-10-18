import { buildDataSourceOptions } from './database.config';

describe('buildDataSourceOptions', () => {
  const env = {
    DB_HOST: 'localhost',
    DB_PORT: '5432',
    DB_USERNAME: 'postgres',
    DB_PASSWORD: 'secret',
    DB_DATABASE: 'wolvo_db',
  };

  it('maps DB_* variables and never synchronises the schema', () => {
    const options = buildDataSourceOptions(env);
    expect(options).toMatchObject({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      database: 'wolvo_db',
      synchronize: false,
    });
  });

  it('allows the database name to be overridden', () => {
    expect(buildDataSourceOptions(env, { database: 'wolvo_test' }).database).toBe('wolvo_test');
  });

  it('names missing variables without revealing values', () => {
    expect(() => buildDataSourceOptions({ ...env, DB_PASSWORD: '', DB_HOST: undefined })).toThrow(
      'Missing database configuration: DB_HOST, DB_PASSWORD',
    );
  });
});
