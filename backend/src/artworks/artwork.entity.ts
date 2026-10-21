import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

// available : en vente · reserved : demande acceptée, en attente de paiement · sold : payée
export type ArtworkStatus = 'available' | 'reserved' | 'sold';

// numeric est renvoyé en string par pg : on le convertit en nombre.
export const decimalTransformer = {
  to: (value: number) => value,
  from: (value: string) => (value === null ? null : parseFloat(value)),
};

@Entity('artworks')
export class Artwork {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ name: 'image_url' })
  imageUrl: string;

  @Column('text', { array: true, default: () => "'{}'" })
  tags: string[];

  @Column('numeric', { precision: 10, scale: 2, transformer: decimalTransformer })
  price: number;

  @Column({ type: 'varchar', length: 16, default: 'available' })
  status: ArtworkStatus;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ name: 'owner_id' })
  ownerId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
