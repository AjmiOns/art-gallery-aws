import {
  BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { QueryFailedError, Repository } from 'typeorm';
import { AdminUpdateUserDto, UpdateProfileDto } from './dto/profile.dto';
import { Role, User } from './user.entity';

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User) private readonly repo: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  // Crée le compte administrateur au premier démarrage (ADMIN_EMAIL / ADMIN_PASSWORD).
  async onModuleInit() {
    const email = this.config.get<string>('ADMIN_EMAIL')?.toLowerCase();
    const password = this.config.get<string>('ADMIN_PASSWORD');
    if (!email || !password) return;
    const existing = await this.repo.findOne({ where: { email } });
    if (existing) {
      if (existing.role !== 'admin') await this.repo.update(existing.id, { role: 'admin' });
      return;
    }
    await this.repo.save(
      this.repo.create({ email, username: 'Administrateur', passwordHash: await bcrypt.hash(password, 10), role: 'admin' }),
    );
    this.logger.log(`Compte administrateur créé : ${email}`);
  }

  create(data: { email: string; username: string; passwordHash: string; role: Role }) {
    return this.repo.save(this.repo.create(data));
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  // passwordHash est exclu par défaut (select: false) : on le demande explicitement.
  findByEmailWithPassword(email: string) {
    return this.repo.createQueryBuilder('u').addSelect('u.passwordHash').where('u.email = :email', { email }).getOne();
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    Object.assign(user, dto);
    return this.repo.save(user);
  }

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    const user = await this.repo.createQueryBuilder('u').addSelect('u.passwordHash').where('u.id = :id', { id }).getOne();
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new BadRequestException('Le mot de passe actuel est incorrect.');
    }
    if (currentPassword === newPassword) throw new BadRequestException("Le nouveau mot de passe doit être différent de l'actuel.");
    await this.repo.update(id, { passwordHash: await bcrypt.hash(newPassword, 10) });
    return { changed: true };
  }

  // ----- administration
  adminList(filters: { role?: string; q?: string; status?: string }) {
    const qb = this.repo.createQueryBuilder('u').orderBy('u.createdAt', 'DESC');
    if (filters.role) qb.andWhere('u.role = :role', { role: filters.role });
    if (filters.status === 'suspended') qb.andWhere('u.isActive = false');
    if (filters.status === 'active') qb.andWhere('u.isActive = true');
    if (filters.q) qb.andWhere('(u.username ILIKE :q OR u.email ILIKE :q)', { q: `%${filters.q}%` });
    return qb.getMany();
  }

  async adminUpdate(id: string, dto: AdminUpdateUserDto, actorId: string) {
    if (id === actorId && (dto.role && dto.role !== 'admin' || dto.isActive === false)) {
      throw new BadRequestException('Vous ne pouvez pas retirer vos propres droits ni suspendre votre compte.');
    }
    return this.updateProfileAndRole(id, dto);
  }

  private async updateProfileAndRole(id: string, dto: AdminUpdateUserDto) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    Object.assign(user, dto);
    return this.repo.save(user);
  }

  async adminRemove(id: string, actorId: string) {
    if (id === actorId) throw new BadRequestException('Vous ne pouvez pas supprimer votre propre compte.');
    try {
      const res = await this.repo.delete(id);
      if (!res.affected) throw new NotFoundException('Utilisateur introuvable.');
      return { deleted: true };
    } catch (e) {
      if (e instanceof QueryFailedError && (e as any).driverError?.code === '23503') {
        throw new ConflictException("Cet utilisateur a des commandes ou des paiements : suspendez son compte plutôt que de le supprimer.");
      }
      throw e;
    }
  }
}
