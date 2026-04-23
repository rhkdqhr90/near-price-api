import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum PointDirection {
  EARN = 'earn',
  DEDUCT = 'deduct',
  REVOKE = 'revoke',
  ADJUST = 'adjust',
}

export enum PointTransactionStatus {
  CONFIRMED = 'confirmed',
  PENDING = 'pending',
  CANCELLED = 'cancelled',
}

export enum PointSourceType {
  PRICE_CREATE = 'price_create',
  PRICE_DELETE = 'price_delete',
  PRICE_DISPUTED = 'price_disputed',
  ADMIN_ADJUST = 'admin_adjust',
}

@Entity('point_transactions')
@Index('IDX_point_transactions_user_createdAt', ['user', 'createdAt'])
@Index('IDX_point_transactions_effectiveAt', ['effectiveAt'])
@Index('IDX_point_transactions_source', ['sourceType', 'sourceId'])
@Index('UQ_point_transactions_idempotencyKey', ['idempotencyKey'], {
  unique: true,
})
@Check('CHK_point_transactions_amount_positive', '"amount" > 0')
@Check(
  'CHK_point_transactions_direction',
  "\"direction\" IN ('earn','deduct','revoke','adjust')",
)
@Check(
  'CHK_point_transactions_status',
  "\"status\" IN ('confirmed','pending','cancelled')",
)
export class PointTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 20 })
  direction: PointDirection;

  @Column({
    type: 'varchar',
    length: 20,
    default: PointTransactionStatus.CONFIRMED,
  })
  status: PointTransactionStatus;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'varchar', length: 40 })
  sourceType: PointSourceType;

  @Column({ type: 'varchar', length: 64 })
  sourceId: string;

  @Column({ type: 'varchar', length: 120 })
  idempotencyKey: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | null) => (v === null ? null : parseFloat(v)),
    },
  })
  activityLat: number | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | null) => (v === null ? null : parseFloat(v)),
    },
  })
  activityLng: number | null;

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, unknown> | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  effectiveAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
