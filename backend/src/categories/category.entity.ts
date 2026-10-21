import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Teintes pastel disponibles côté interface
export const TONES = ['peach', 'mint', 'lavender', 'sky', 'pink', 'butter'];

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Identifiant stable référencé par artworks.tags : il n'est pas modifiable.
  @Column({ unique: true })
  slug: string;

  @Column()
  label: string;

  @Column({ default: '' })
  tagline: string;

  @Column({ type: 'varchar', length: 16, default: 'lavender' })
  tone: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
