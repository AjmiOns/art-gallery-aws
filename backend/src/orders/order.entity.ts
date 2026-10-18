import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Artwork, decimalTransformer } from '../artworks/artwork.entity';
import { User } from '../users/user.entity';

// Une commande = une vente à prix fixe (achat direct).
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

  @Column({ name: 'seller_id' })
  sellerId: string;

  // Prix figé au moment de la vente
  @Column('numeric', { precision: 10, scale: 2, transformer: decimalTransformer })
  amount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
