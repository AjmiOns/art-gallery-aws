import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from '../categories/categories.module';
import { User } from '../users/user.entity';
import { Artwork } from './artwork.entity';
import { ArtworksController } from './artworks.controller';
import { ArtworksService } from './artworks.service';

@Module({
  imports: [TypeOrmModule.forFeature([Artwork, User]), CategoriesModule],
  controllers: [ArtworksController],
  providers: [ArtworksService],
  exports: [ArtworksService],
})
export class ArtworksModule {}
