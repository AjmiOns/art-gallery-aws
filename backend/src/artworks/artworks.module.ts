import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from '../categories/categories.module';
import { Artwork } from './artwork.entity';
import { ArtworksController } from './artworks.controller';
import { ArtworksService } from './artworks.service';

@Module({
  imports: [TypeOrmModule.forFeature([Artwork]), CategoriesModule],
  controllers: [ArtworksController],
  providers: [ArtworksService],
  exports: [ArtworksService],
})
export class ArtworksModule {}
