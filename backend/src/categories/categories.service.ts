import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Artwork } from '../artworks/artwork.entity';
import { Category } from './category.entity';
import { CreateCategoryDto, UpdateCategoryDto } from './category.dto';

const DEFAULTS = [
  { slug: 'painting', label: 'Peintures', tagline: 'Huile, acrylique, couteau et pouring', tone: 'peach' },
  { slug: 'wall-art', label: 'Décoration murale', tagline: 'Affiches et compositions pour vos murs', tone: 'mint' },
  { slug: 'digital', label: 'Art numérique', tagline: 'Créations génératives et illustrations', tone: 'lavender' },
  { slug: 'sketch', label: 'Croquis', tagline: 'Graphite, études et dessins botaniques', tone: 'sky' },
];

@Injectable()
export class CategoriesService implements OnModuleInit {
  constructor(
    @InjectRepository(Category) private readonly repo: Repository<Category>,
    @InjectRepository(Artwork) private readonly artworks: Repository<Artwork>,
  ) {}

  // Catégories de départ au premier démarrage
  async onModuleInit() {
    if ((await this.repo.count()) > 0) return;
    await this.repo.save(DEFAULTS.map((c, i) => this.repo.create({ ...c, sortOrder: i })));
  }

  findActive() {
    return this.repo.find({ where: { isActive: true }, order: { sortOrder: 'ASC', label: 'ASC' } });
  }

  findAll() {
    return this.repo.find({ order: { sortOrder: 'ASC', label: 'ASC' } });
  }

  // Les tags d'une œuvre doivent correspondre à des catégories actives.
  async assertSlugs(tags: string[]) {
    const unique = [...new Set(tags)];
    const found = await this.repo.find({ where: { slug: In(unique), isActive: true } });
    const known = new Set(found.map((c) => c.slug));
    const unknown = unique.filter((t) => !known.has(t));
    if (unknown.length) throw new BadRequestException(`Catégorie inconnue ou désactivée : ${unknown.join(', ')}`);
  }

  async create(dto: CreateCategoryDto) {
    if (await this.repo.findOne({ where: { slug: dto.slug } })) throw new ConflictException('Ce slug existe déjà.');
    const max = await this.repo.createQueryBuilder('c').select('COALESCE(MAX(c.sortOrder), -1)', 'max').getRawOne();
    return this.repo.save(
      this.repo.create({
        slug: dto.slug,
        label: dto.label,
        tagline: dto.tagline ?? '',
        tone: dto.tone ?? 'lavender',
        sortOrder: dto.sortOrder ?? Number(max.max) + 1,
      }),
    );
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.repo.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Catégorie introuvable.');
    Object.assign(category, dto);
    return this.repo.save(category);
  }

  async remove(id: string) {
    const category = await this.repo.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Catégorie introuvable.');
    const used = await this.artworks.createQueryBuilder('a').where(':slug = ANY(a.tags)', { slug: category.slug }).getCount();
    if (used > 0) {
      throw new ConflictException(`${used} œuvre(s) utilisent cette catégorie : désactivez-la plutôt que de la supprimer.`);
    }
    await this.repo.remove(category);
    return { deleted: true };
  }
}
