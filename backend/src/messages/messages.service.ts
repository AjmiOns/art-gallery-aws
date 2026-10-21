import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Artwork } from '../artworks/artwork.entity';
import { AuthUser } from '../common/current-user.decorator';
import { User } from '../users/user.entity';
import { Message } from './message.entity';

@Injectable()
export class MessagesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Message) private readonly repo: Repository<Message>,
  ) {}

  async send(user: AuthUser, dto: { recipientId: string; body: string; artworkId?: string }) {
    if (dto.recipientId === user.userId) throw new BadRequestException('Vous ne pouvez pas vous écrire à vous-même.');
    const recipient = await this.dataSource.getRepository(User).findOne({ where: { id: dto.recipientId } });
    if (!recipient || !recipient.isActive) throw new NotFoundException('Destinataire introuvable.');
    await this.assertCanContact(user, recipient, dto.artworkId);
    return this.repo.save(
      this.repo.create({ senderId: user.userId, recipientId: dto.recipientId, artworkId: dto.artworkId ?? null, body: dto.body.trim() }),
    );
  }

  // Anti-spam : on écrit à l'artiste d'une œuvre, à quelqu'un avec qui on a déjà échangé
  // ou une commande en commun. Les administrateurs peuvent écrire à tous et recevoir de tous.
  private async assertCanContact(user: AuthUser, recipient: User, artworkId?: string) {
    if (user.role === 'admin' || recipient.role === 'admin') return;
    if (artworkId) {
      const artwork = await this.dataSource.getRepository(Artwork).findOne({ where: { id: artworkId } });
      if (artwork?.ownerId === recipient.id) return;
    }
    const [{ n }] = await this.dataSource.query(
      `SELECT (
         (SELECT COUNT(*) FROM messages WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)) +
         (SELECT COUNT(*) FROM orders WHERE (buyer_id = $1 AND seller_id = $2) OR (buyer_id = $2 AND seller_id = $1))
       )::int AS n`,
      [user.userId, recipient.id],
    );
    if (n === 0) throw new ForbiddenException("Contactez un artiste depuis la fiche de l'une de ses œuvres.");
  }

  async threads(userId: string) {
    const rows = await this.dataSource.query(
      `WITH m AS (
         SELECT *, CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS other_id
         FROM messages WHERE sender_id = $1 OR recipient_id = $1
       )
       SELECT DISTINCT ON (m.other_id)
         m.other_id AS "userId", u.username, u.role,
         m.body AS "lastMessage", m.created_at AS "lastAt", (m.sender_id = $1) AS "lastFromMe",
         (SELECT COUNT(*)::int FROM messages x WHERE x.sender_id = m.other_id AND x.recipient_id = $1 AND x.read_at IS NULL) AS unread
       FROM m JOIN users u ON u.id = m.other_id
       ORDER BY m.other_id, m.created_at DESC`,
      [userId],
    );
    return rows.sort((a: any, b: any) => +new Date(b.lastAt) - +new Date(a.lastAt));
  }

  async conversation(user: AuthUser, otherId: string) {
    const other = await this.dataSource.getRepository(User).findOne({ where: { id: otherId } });
    if (!other) throw new NotFoundException('Utilisateur introuvable.');
    const messages = await this.repo
      .createQueryBuilder('m')
      .leftJoin('m.artwork', 'a')
      .addSelect(['a.id', 'a.title'])
      .where('(m.senderId = :me AND m.recipientId = :other) OR (m.senderId = :other AND m.recipientId = :me)', { me: user.userId, other: otherId })
      .orderBy('m.createdAt', 'ASC')
      .getMany();
    await this.repo.update({ senderId: otherId, recipientId: user.userId, readAt: IsNull() }, { readAt: new Date() });
    return { user: { id: other.id, username: other.username, role: other.role }, messages };
  }

  async unreadCount(userId: string) {
    const unread = await this.repo.count({ where: { recipientId: userId, readAt: IsNull() } });
    return { unread };
  }
}
