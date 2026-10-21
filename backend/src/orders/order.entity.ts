import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Artwork, decimalTransformer } from '../artworks/artwork.entity';
import { User } from '../users/user.entity';

// pending  : demande envoyée par l'acheteur
// accepted : acceptée par l'artiste, l'œuvre est réservée en attente du paiement
// rejected : refusée par l'artiste · cancelled : annulée · paid : payée, œuvre vendue
export type OrderStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'paid';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Artwork, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'artwork_id' })
  artwork: Artwork;

  @Column({ name: 'artwork_id' })
  artworkId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'buyer_id' })
  buyer: User;

  @Column({ name: 'buyer_id' })
  buyerId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'seller_id' })
  seller: User;

  @Column({ name: 'seller_id' })
  sellerId: string;

  // Prix figé au moment de la demande
  @Column('numeric', { precision: 10, scale: 2, transformer: decimalTransformer })
  amount: number;

  // Message de l'acheteur joint à la demande
  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: OrderStatus;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
