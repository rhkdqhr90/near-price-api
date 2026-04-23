import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('point_wallets')
@Check(
  'CHK_point_wallets_non_negative',
  '"availablePoints" >= 0 AND "pendingPoints" >= 0 AND "lifetimeEarned" >= 0 AND "lifetimeSpent" >= 0',
)
export class PointWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'int', default: 0 })
  availablePoints: number;

  @Column({ type: 'int', default: 0 })
  pendingPoints: number;

  @Column({ type: 'int', default: 0 })
  lifetimeEarned: number;

  @Column({ type: 'int', default: 0 })
  lifetimeSpent: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
