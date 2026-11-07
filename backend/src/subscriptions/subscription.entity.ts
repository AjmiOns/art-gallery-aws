import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from '../artworks/artwork.entity';
import { User } from '../users/user.entity';
import type { Billing, PlanId } from './plans';

export type SubscriptionStatus = 'pending' | 'succeeded' | 'failed';

// Un achat d'abonnement (une ligne = une facture). Le plan actif de l'artiste est recopié sur users.plan.
@Entity('subscriptions')
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 16 })
  plan: PlanId;

  @Column({ type: 'varchar', length: 8 })
  billing: Billing;

  // Prix figé à l'achat
  @Column('numeric', { precision: 10, scale: 2, transformer: decimalTransformer })
  amount: number;

  @Column({ type: 'varchar', length: 8 })
  currency: string;

  // mock : passerelle de démonstration · stripe : Stripe Checkout (mode test)
  @Column({ type: 'varchar', length: 16 })
  provider: string;

  @Column({ name: 'provider_ref', type: 'varchar', nullable: true })
  providerRef: string | null;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: SubscriptionStatus;

  @Column({ name: 'card_brand', type: 'varchar', length: 24, nullable: true })
  cardBrand: string | null;

  // Seuls les 4 derniers chiffres sont conservés, jamais le numéro complet.
  @Column({ name: 'card_last4', type: 'varchar', length: 4, nullable: true })
  cardLast4: string | null;

  @Column({ name: 'failure_reason', type: 'varchar', nullable: true })
  failureReason: string | null;

  // Période couverte, renseignée à l'activation
  @Column({ name: 'starts_at', type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ name: 'ends_at', type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
