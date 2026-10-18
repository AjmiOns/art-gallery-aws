import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { ArtworksService } from './artworks.service';
import { CreateArtworkDto } from './dto/create-artwork.dto';
import { QueryArtworksDto } from './dto/query-artworks.dto';
import { UpdateArtworkDto } from './dto/update-artwork.dto';

@Controller('artworks')
export class ArtworksController {
  constructor(private readonly artworks: ArtworksService) {}

  @Get()
  findAll(@Query() query: QueryArtworksDto) {
    return this.artworks.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.artworks.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateArtworkDto) {
    return this.artworks.create(user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Body() dto: UpdateArtworkDto) {
    return this.artworks.update(id, user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.artworks.remove(id, user.userId);
  }
}
