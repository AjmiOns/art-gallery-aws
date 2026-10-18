import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Artwork } from '../artworks/artwork.entity';
import { Order } from './order.entity';

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
  ) {}

  // Achat direct : tout se passe dans une transaction avec verrou sur l'œuvre,
  // pour qu'elle ne puisse jamais être vendue deux fois.
  async buy(artworkId: string, buyerId: string) {
    return this.dataSource.transaction(async (manager) => {
      const artwork = await manager.findOne(Artwork, {
        where: { id: artworkId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!artwork) throw new NotFoundException('Œuvre introuvable.');
      if (artwork.status !== 'available') throw new BadRequestException('Cette œuvre est déjà vendue.');
      if (artwork.ownerId === buyerId) throw new BadRequestException('Vous ne pouvez pas acheter votre propre œuvre.');

      artwork.status = 'sold';
      await manager.save(artwork);

      // TODO notifications : prévenir acheteur et vendeur (service à définir, voir README).
      return manager.save(
        manager.create(Order, {
          artworkId: artwork.id,
          buyerId,
          sellerId: artwork.ownerId,
          amount: artwork.price,
        }),
      );
    });
  }

  // Achats et ventes de l'utilisateur connecté
  findMine(userId: string) {
    return this.orders.find({
      where: [{ buyerId: userId }, { sellerId: userId }],
      relations: { artwork: true },
      order: { createdAt: 'DESC' },
    });
  }
}
