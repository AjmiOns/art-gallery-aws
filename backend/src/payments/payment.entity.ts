import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from '../artworks/artwork.entity';
import { Order } from '../orders/order.entity';

export type PaymentStatus = 'pending' | 'succeeded' | 'failed';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'order_id' })
  orderId: string;

  // mock : passerelle de démonstration · stripe : Stripe Checkout (mode test)
  @Column({ type: 'varchar', length: 16 })
  provider: string;

  // Identifiant côté prestataire (session Stripe)
  @Column({ name: 'provider_ref', type: 'varchar', nullable: true })
  providerRef: string | null;

  @Column('numeric', { precision: 10, scale: 2, transformer: decimalTransformer })
  amount: number;

  @Column({ type: 'varchar', length: 8 })
  currency: string;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: PaymentStatus;

  @Column({ name: 'card_brand', type: 'varchar', length: 24, nullable: true })
  cardBrand: string | null;

  // Seuls les 4 derniers chiffres sont conservés, jamais le numéro complet.
  @Column({ name: 'card_last4', type: 'varchar', length: 4, nullable: true })
  cardLast4: string | null;

  @Column({ name: 'failure_reason', type: 'varchar', nullable: true })
  failureReason: string | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
