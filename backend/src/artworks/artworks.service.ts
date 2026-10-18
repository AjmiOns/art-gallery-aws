import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Artwork } from './artwork.entity';
import { CreateArtworkDto } from './dto/create-artwork.dto';
import { QueryArtworksDto } from './dto/query-artworks.dto';
import { UpdateArtworkDto } from './dto/update-artwork.dto';

@Injectable()
export class ArtworksService {
  constructor(@InjectRepository(Artwork) private readonly repo: Repository<Artwork>) {}

  // Filtres combinables : ?tag=painting&maxPrice=50&q=lune
  findAll(query: QueryArtworksDto) {
    const qb = this.repo
      .createQueryBuilder('a')
      .leftJoin('a.owner', 'o')
      .addSelect(['o.id', 'o.username'])
      .orderBy('a.createdAt', 'DESC');

    if (query.tag) qb.andWhere(':tag = ANY(a.tags)', { tag: query.tag });
    if (query.maxPrice !== undefined) qb.andWhere('a.price <= :maxPrice', { maxPrice: query.maxPrice });
    if (query.q) qb.andWhere('a.title ILIKE :q', { q: `%${query.q}%` });

    return qb.getMany();
  }

  async findOne(id: string) {
    const artwork = await this.repo.findOne({ where: { id }, relations: { owner: true } });
    if (!artwork) throw new NotFoundException('Œuvre introuvable.');
    return artwork;
  }

  create(ownerId: string, dto: CreateArtworkDto) {
    return this.repo.save(this.repo.create({ ...dto, tags: dto.tags ?? [], ownerId }));
  }

  async update(id: string, userId: string, dto: UpdateArtworkDto) {
    const artwork = await this.findOwned(id, userId);
    Object.assign(artwork, dto);
    return this.repo.save(artwork);
  }

  async remove(id: string, userId: string) {
    const artwork = await this.findOwned(id, userId);
    await this.repo.remove(artwork);
    return { deleted: true };
  }

  // Seul le propriétaire peut modifier ou supprimer son œuvre.
  private async findOwned(id: string, userId: string) {
    const artwork = await this.repo.findOne({ where: { id } });
    if (!artwork) throw new NotFoundException('Œuvre introuvable.');
    if (artwork.ownerId !== userId) throw new ForbiddenException("Cette œuvre ne vous appartient pas.");
    return artwork;
  }
}
