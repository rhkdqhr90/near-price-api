import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { BadgeDefinition } from './badge-definition.entity';

@Entity('user_badges')
@Unique(['user', 'badgeDefinition'])
export class UserBadge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => BadgeDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'badge_id' })
  badgeDefinition: BadgeDefinition;

  @CreateDateColumn()
  earnedAt: Date;
}
