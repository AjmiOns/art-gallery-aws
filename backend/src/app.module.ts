import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ArtworksModule } from './artworks/artworks.module';
import { OrdersModule } from './orders/orders.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: Number(config.get('DB_PORT', 5432)),
        username: config.get('DB_USER', 'gallery'),
        password: config.get('DB_PASSWORD', 'gallery'),
        database: config.get('DB_NAME', 'art_gallery'),
        ssl: config.get('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
        autoLoadEntities: true,
        // Pratique en dev ; en production on passera à des migrations.
        synchronize: config.get('NODE_ENV') !== 'production',
      }),
    }),
    UsersModule,
    AuthModule,
    ArtworksModule,
    OrdersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
