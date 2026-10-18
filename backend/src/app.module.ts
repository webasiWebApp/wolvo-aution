import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { buildDataSourceOptions } from './config/database.config';
import { ListingsModule } from './listings/listings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({ ...buildDataSourceOptions(), autoLoadEntities: true }),
    }),
    AuthModule,
    ListingsModule,
  ],
})
export class AppModule {}
