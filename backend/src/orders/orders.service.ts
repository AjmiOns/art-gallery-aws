import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Artwork } from '../artworks/artwork.entity';
import { AuthUser } from '../common/current-user.decorator';
import { Order } from './order.entity';

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(Artwork) private readonly artworks: Repository<Artwork>,
  ) {}

  // Commande avec l'œuvre et les noms des deux parties (jamais leurs e-mails)
  private view() {
    return this.orders
      .createQueryBuilder('o')
      .leftJoin('o.artwork', 'a')
      .addSelect(['a.id', 'a.title', 'a.imageUrl', 'a.price', 'a.status', 'a.tags'])
      .leftJoin('o.buyer', 'b')
      .addSelect(['b.id', 'b.username'])
      .leftJoin('o.seller', 's')
      .addSelect(['s.id', 's.username'])
      .orderBy('o.createdAt', 'DESC');
  }

  // 1. L'acheteur envoie une demande : l'œuvre n'est PAS vendue pour autant.
  async request(user: AuthUser, artworkId: string, message?: string) {
    const artwork = await this.artworks.findOne({ where: { id: artworkId } });
    if (!artwork) throw new NotFoundException('Œuvre introuvable.');
    if (artwork.ownerId === user.userId) throw new BadRequestException('Vous ne pouvez pas acheter votre propre œuvre.');
    if (artwork.status !== 'available') throw new ConflictException("Cette œuvre n'est plus disponible.");
    const open = await this.orders.count({
      where: [
        { artworkId, buyerId: user.userId, status: 'pending' },
        { artworkId, buyerId: user.userId, status: 'accepted' },
      ],
    });
    if (open > 0) throw new ConflictException('Vous avez déjà une demande en cours pour cette œuvre.');
    const order = await this.orders.save(
      this.orders.create({
        artworkId,
        buyerId: user.userId,
        sellerId: artwork.ownerId,
        amount: artwork.price,
        message: message?.trim() || null,
      }),
    );
    return this.getOne(order.id, user);
  }

  listBought(userId: string) {
    return this.view().where('o.buyerId = :userId', { userId }).getMany();
  }

  listSales(userId: string) {
    return this.view().where('o.sellerId = :userId', { userId }).getMany();
  }

  adminList(status?: string) {
    const qb = this.view();
    if (status) qb.where('o.status = :status', { status });
    return qb.getMany();
  }

  async getOne(id: string, user: AuthUser) {
    const order = await this.view().where('o.id = :id', { id }).getOne();
    if (!order) throw new NotFoundException('Commande introuvable.');
    const participant = order.buyer.id === user.userId || order.seller.id === user.userId;
    if (!participant && user.role !== 'admin') throw new ForbiddenException("Cette commande ne vous concerne pas.");
    const [payment] = await this.dataSource.query(
      `SELECT id, provider, status, card_brand AS "cardBrand", card_last4 AS "cardLast4", currency, paid_at AS "paidAt"
       FROM payments WHERE order_id = $1 AND status = 'succeeded' ORDER BY paid_at DESC LIMIT 1`,
      [id],
    );
    return { ...order, payment: payment ?? null };
  }

  // 2. L'artiste accepte : l'œuvre est réservée pour cet acheteur, les autres demandes sont refusées.
  async accept(id: string, user: AuthUser) {
    await this.dataSource.transaction(async (m) => {
      const order = await m.findOne(Order, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!order) throw new NotFoundException('Commande introuvable.');
      this.assertSeller(order, user);
      if (order.status !== 'pending') throw new BadRequestException('Cette demande a déjà été traitée.');
      const artwork = await m.findOne(Artwork, { where: { id: order.artworkId }, lock: { mode: 'pessimistic_write' } });
      if (!artwork || artwork.status !== 'available') throw new ConflictException("Cette œuvre n'est plus disponible.");
      artwork.status = 'reserved';
      await m.save(artwork);
      order.status = 'accepted';
      await m.save(order);
      await m.update(Order, { artworkId: artwork.id, status: 'pending' }, { status: 'rejected' });
    });
    return this.getOne(id, user);
  }

  async reject(id: string, user: AuthUser) {
    const order = await this.orders.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Commande introuvable.');
    this.assertSeller(order, user);
    if (order.status !== 'pending') throw new BadRequestException('Seule une demande en attente peut être refusée.');
    order.status = 'rejected';
    await this.orders.save(order);
    return this.getOne(id, user);
  }

  // L'acheteur, l'artiste ou un admin peut annuler tant que la commande n'est pas payée.
  async cancel(id: string, user: AuthUser) {
    await this.dataSource.transaction(async (m) => {
      const order = await m.findOne(Order, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!order) throw new NotFoundException('Commande introuvable.');
      const allowed = order.buyerId === user.userId || order.sellerId === user.userId || user.role === 'admin';
      if (!allowed) throw new ForbiddenException("Cette commande ne vous concerne pas.");
      if (order.status !== 'pending' && order.status !== 'accepted') {
        throw new BadRequestException('Cette commande ne peut plus être annulée.');
      }
      if (order.status === 'accepted') {
        const artwork = await m.findOne(Artwork, { where: { id: order.artworkId }, lock: { mode: 'pessimistic_write' } });
        if (artwork?.status === 'reserved') {
          artwork.status = 'available';
          await m.save(artwork);
        }
      }
      order.status = 'cancelled';
      await m.save(order);
    });
    return this.getOne(id, user);
  }

  private assertSeller(order: Order, user: AuthUser) {
    if (order.sellerId !== user.userId && user.role !== 'admin') {
      throw new ForbiddenException("Seul l'artiste de cette œuvre peut traiter la demande.");
    }
  }
}
