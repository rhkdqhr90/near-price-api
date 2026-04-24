import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Store } from '../../store/entities/store.entity';
import { User } from '../../user/entities/user.entity';

export enum OwnerApplicationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('owner_applications')
@Index('UQ_owner_applications_user_id', ['user'], { unique: true })
@Index('IDX_owner_applications_status', ['status'])
@Index('IDX_owner_applications_created_at', ['createdAt'])
export class OwnerApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Store, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column({ length: 100 })
  ownerName: string;

  @Column({ length: 30 })
  ownerPhone: string;

  @Column({ type: 'text' })
  businessRegistrationNumberEncrypted: string;

  @Column({ length: 20 })
  businessRegistrationNumberMasked: string;

  @Column({ type: 'text' })
  proofImageUrl: string;

  @Column({
    type: 'enum',
    enum: OwnerApplicationStatus,
    default: OwnerApplicationStatus.PENDING,
  })
  status: OwnerApplicationStatus;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reviewed_by_admin_id' })
  reviewedByAdmin: User | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
