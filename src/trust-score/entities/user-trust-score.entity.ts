import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('user_trust_scores')
export class UserTrustScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 50,
    transformer: {
      to: (v: number) => v,
      from: (v: string | number) => (typeof v === 'string' ? parseFloat(v) : v),
    },
  })
  trustScore: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 50,
    transformer: {
      to: (v: number) => v,
      from: (v: string | number) => (typeof v === 'string' ? parseFloat(v) : v),
    },
  })
  registrationScore: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 50,
    transformer: {
      to: (v: number) => v,
      from: (v: string | number) => (typeof v === 'string' ? parseFloat(v) : v),
    },
  })
  verificationScore: number;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: {
      to: (v: number) => v,
      from: (v: string | number) => (typeof v === 'string' ? parseFloat(v) : v),
    },
  })
  consistencyBonus: number;

  @Column({ type: 'int', default: 0 })
  totalRegistrations: number;

  @Column({ type: 'int', default: 0 })
  totalVerifications: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  calculatedAt: Date;
}
