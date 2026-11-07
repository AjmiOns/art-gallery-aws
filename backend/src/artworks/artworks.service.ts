import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository, SelectQueryBuilder } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { AuthUser } from '../common/current-user.decorator';
import { effectivePlan, effectivePlanId } from '../subscriptions/plans';
import { User } from '../users/user.entity';
import { Artwork } from './artwork.entity';
import { CreateArtworkDto } from './dto/create-artwork.dto';
import { QueryArtworksDto } from './dto/query-artworks.dto';
import { UpdateArtworkDto } from './dto/update-artwork.dto';

@Injectable()
export class ArtworksService {
  constructor(
    @InjectRepository(Artwork) private readonly repo: Repository<Artwork>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly categories: CategoriesService,
  ) {}

  private baseQuery() {
    return this.repo.createQueryBuilder('a').leftJoin('a.owner', 'o').addSelect(['o.id', 'o.username', 'o.plan', 'o.planExpiresAt']);
  }

  // Les œuvres des artistes Premium et Pro passent en tête du catalogue ; à plan égal, les plus récentes d'abord.
  private withPriority(qb: SelectQueryBuilder<Artwork>) {
    return qb
      .addSelect(`CASE WHEN "o"."plan" <> 'free' AND "o"."plan_expires_at" > now() THEN 1 ELSE 0 END`, 'priority')
      .orderBy('priority', 'DESC')
      .addOrderBy('a.createdAt', 'DESC');
  }

  // Le public ne voit du propriétaire que son nom et son plan effectif (badge) : ni e-mail, ni date d'expiration.
  private present<T extends Artwork>(artwork: T): T {
    const o = artwork.owner;
    if (!o) return artwork;
    return { ...artwork, owner: { id: o.id, username: o.username, plan: effectivePlanId(o) } } as unknown as T;
  }

  // Filtres combinables : ?tag=painting&maxPrice=50&q=lune
  findAll(query: QueryArtworksDto) {
    const qb = this.baseQuery();
    if (query.tag) qb.andWhere(':tag = ANY(a.tags)', { tag: query.tag });
    if (query.maxPrice !== undefined) qb.andWhere('a.price <= :maxPrice', { maxPrice: query.maxPrice });
    if (query.q) qb.andWhere('a.title ILIKE :q', { q: `%${query.q}%` });
    if (query.status) qb.andWhere('a.status = :status', { status: query.status });
    return this.withPriority(qb).getMany().then((list) => list.map((a) => this.present(a)));
  }

  findMine(userId: string) {
    return this.baseQuery().where('a.ownerId = :userId', { userId }).orderBy('a.createdAt', 'DESC').getMany()
      .then((list) => list.map((a) => this.present(a)));
  }

  async findOne(id: string) {
    const artwork = await this.repo.findOne({ where: { id }, relations: { owner: true } });
    if (!artwork) throw new NotFoundException('Œuvre introuvable.');
    return this.present(artwork);
  }

  // Limite d'œuvres en ligne (disponibles ou réservées) selon l'abonnement de l'artiste.
  private async assertQuota(userId: string) {
    const owner = await this.users.findOne({ where: { id: userId } });
    const plan = effectivePlan(owner);
    if (plan.maxArtworks === null) return;
    const online = await this.repo.count({ where: [{ ownerId: userId, status: 'available' }, { ownerId: userId, status: 'reserved' }] });
    if (online >= plan.maxArtworks) {
      throw new ForbiddenException(
        `Votre abonnement ${plan.name} est limité à ${plan.maxArtworks} œuvres en ligne. Passez à un abonnement supérieur pour en publier davantage.`,
      );
    }
  }

  async create(user: AuthUser, dto: CreateArtworkDto) {
    await this.categories.assertSlugs(dto.tags);
    if (user.role === 'artist') await this.assertQuota(user.userId);
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
