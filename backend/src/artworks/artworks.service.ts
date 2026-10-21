import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { AuthUser } from '../common/current-user.decorator';
import { Artwork } from './artwork.entity';
import { CreateArtworkDto } from './dto/create-artwork.dto';
import { QueryArtworksDto } from './dto/query-artworks.dto';
import { UpdateArtworkDto } from './dto/update-artwork.dto';

@Injectable()
export class ArtworksService {
  constructor(
    @InjectRepository(Artwork) private readonly repo: Repository<Artwork>,
    private readonly categories: CategoriesService,
  ) {}

  private baseQuery() {
    return this.repo.createQueryBuilder('a').leftJoin('a.owner', 'o').addSelect(['o.id', 'o.username']).orderBy('a.createdAt', 'DESC');
  }

  // Filtres combinables : ?tag=painting&maxPrice=50&q=lune
  findAll(query: QueryArtworksDto) {
    const qb = this.baseQuery();
    if (query.tag) qb.andWhere(':tag = ANY(a.tags)', { tag: query.tag });
    if (query.maxPrice !== undefined) qb.andWhere('a.price <= :maxPrice', { maxPrice: query.maxPrice });
    if (query.q) qb.andWhere('a.title ILIKE :q', { q: `%${query.q}%` });
    if (query.status) qb.andWhere('a.status = :status', { status: query.status });
    return qb.getMany();
  }

  findMine(userId: string) {
    return this.baseQuery().where('a.ownerId = :userId', { userId }).getMany();
  }

  async findOne(id: string) {
    const artwork = await this.repo.findOne({ where: { id }, relations: { owner: true } });
    if (!artwork) throw new NotFoundException('Œuvre introuvable.');
    return artwork;
  }

  async create(user: AuthUser, dto: CreateArtworkDto) {
    await this.categories.assertSlugs(dto.tags);
    return this.repo.save(this.repo.create({ ...dto, ownerId: user.userId }));
  }

  async update(id: string, user: AuthUser, dto: UpdateArtworkDto) {
    const artwork = await this.findManageable(id, user);
    if (dto.tags) await this.categories.assertSlugs(dto.tags);
    if (artwork.status !== 'available' && dto.price !== undefined && dto.price !== artwork.price) {
      throw new BadRequestException("Le prix d'une œuvre réservée ou vendue ne peut plus être modifié.");
    }
    Object.assign(artwork, dto);
    return this.repo.save(artwork);
  }

  async remove(id: string, user: AuthUser) {
    const artwork = await this.findManageable(id, user);
    try {
      await this.repo.remove(artwork);
    } catch (e) {
      if (e instanceof QueryFailedError && (e as any).driverError?.code === '23503') {
        throw new ConflictException("Cette œuvre a des commandes associées : elle ne peut pas être supprimée.");
      }
      throw e;
    }
    return { deleted: true };
  }

  // Le propriétaire ou un administrateur peut gérer l'œuvre.
  private async findManageable(id: string, user: AuthUser) {
    const artwork = await this.repo.findOne({ where: { id } });
    if (!artwork) throw new NotFoundException('Œuvre introuvable.');
    if (artwork.ownerId !== user.userId && user.role !== 'admin') {
      throw new ForbiddenException('Cette œuvre ne vous appartient pas.');
    }
    return artwork;
  }
}
