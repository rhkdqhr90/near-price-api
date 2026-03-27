import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('owner_posts')
export class OwnerPost {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ownerName: string;

  @Column()
  badge: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ default: '🏪' })
  emoji: string;

  @Column({ type: 'int', default: 0 })
  likeCount: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
