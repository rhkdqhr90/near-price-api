import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Price } from '../../price/entities/price.entity';
import { User } from '../../user/entities/user.entity';

export enum VerificationResult {
  CONFIRMED = 'confirmed',
  DISPUTED = 'disputed',
}

@Entity('price_verifications')
@Unique(['price', 'verifier'])
export class PriceVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Price, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'price_id' })
  price: Price;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'verifier_id' })
  verifier: User;

  @Column({ type: 'enum', enum: VerificationResult })
  result: VerificationResult;

  @Column({
    type: 'int',
    nullable: true,
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | null | number) =>
        v === null ? null : typeof v === 'string' ? parseInt(v, 10) : v,
    },
  })
  actualPrice: number | null;

  @ManyToOne(() => Price, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'new_price_id' })
  newPrice: Price | null;

  @CreateDateColumn()
  createdAt: Date;
}
