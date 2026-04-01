import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Store } from './store.entity';
import { User } from '../../user/entities/user.entity';

@Entity('store_reviews')
@Unique(['store', 'user'])
export class StoreReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'varchar', nullable: true })
  comment: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
