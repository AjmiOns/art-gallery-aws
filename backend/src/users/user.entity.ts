import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { Billing, PlanId } from '../subscriptions/plans';

export type Role = 'admin' | 'artist' | 'buyer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  username: string;

  @Column({ name: 'password_hash', select: false })
  passwordHash: string;

  @Column({ type: 'varchar', length: 16, default: 'buyer' })
  role: Role;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  city: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  // Un compte suspendu ne peut plus se connecter ni utiliser l'API.
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Abonnement artiste. Un plan payant n'est valable que jusqu'à plan_expires_at (voir effectivePlanId).
  @Column({ type: 'varchar', length: 16, default: 'free' })
  plan: PlanId;

  @Column({ name: 'plan_billing', type: 'varchar', length: 8, nullable: true })
  planBilling: Billing | null;

  @Column({ name: 'plan_expires_at', type: 'timestamptz', nullable: true })
  planExpiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
