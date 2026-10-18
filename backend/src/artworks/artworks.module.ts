import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Artwork } from './artwork.entity';
import { ArtworksController } from './artworks.controller';
import { ArtworksService } from './artworks.service';

@Module({
  imports: [TypeOrmModule.forFeature([Artwork])],
  controllers: [ArtworksController],
  providers: [ArtworksService],
})
export class ArtworksModule {}
