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

export enum PriceReactionType {
  CONFIRM = 'confirm',
  REPORT = 'report',
}

@Entity('price_reactions')
@Unique(['price', 'user'])
export class PriceReaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Price, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'price_id' })
  price: Price;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: PriceReactionType })
  type: PriceReactionType;

  @Column({ nullable: true, type: 'varchar' })
  reason: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
