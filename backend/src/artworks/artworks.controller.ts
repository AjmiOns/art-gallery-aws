import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthUser, CurrentUser } from '../common/current-user.decorator';
import { Roles, RolesGuard } from '../common/roles';
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

  // Doit être déclaré avant ':id'
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.artworks.findMine(user.userId);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.artworks.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist', 'admin')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateArtworkDto) {
    return this.artworks.create(user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist', 'admin')
  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser, @Body() dto: UpdateArtworkDto) {
    return this.artworks.update(id, user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist', 'admin')
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.artworks.remove(id, user);
  }
}
