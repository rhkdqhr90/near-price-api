import {
  Column,
  CreateDateColumn,
  Entity,
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
  store: Store;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'varchar', nullable: true })
  comment: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
