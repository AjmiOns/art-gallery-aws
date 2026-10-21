import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Artwork } from '../artworks/artwork.entity';
import { User } from '../users/user.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  @Column({ name: 'sender_id' })
  senderId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_id' })
  recipient: User;

  @Column({ name: 'recipient_id' })
  recipientId: string;

  // Œuvre concernée par la discussion (facultatif)
  @ManyToOne(() => Artwork, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'artwork_id' })
  artwork: Artwork | null;

  @Column({ name: 'artwork_id', type: 'uuid', nullable: true })
  artworkId: string | null;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
