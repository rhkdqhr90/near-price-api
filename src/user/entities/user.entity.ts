import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserOauth } from './user-oauth.entity';
import { Price } from '../../price/entities/price.entity';
import { Wishlist } from '../../wishlist/entities/wishlist.entity';

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  nickname: string;

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
  latitude: number | null;

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
  longitude: number | null;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ type: 'varchar', nullable: true })
  profileImageUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  fcmToken: string | null;

  @Column({ default: true })
  notifPriceChange: boolean;

  @Column({ default: false })
  notifPromotion: boolean;

  @Column({ type: 'timestamp', nullable: true })
  nicknameChangedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  trustScore: number;

  /**
   * 사용자가 BadgeScreen에서 선택한 대표 뱃지 ID.
   * 작성한 글(가격 카드, 검증, 리뷰 등)의 닉네임 옆에 표시된다.
   * BadgeDefinition.id (`masil_1` ~ `masil_23`)를 가리킴.
   * null = 미선택 (어떤 뱃지도 표시 안 함)
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  representativeBadgeId: string | null;

  @OneToMany(() => UserOauth, (oauth) => oauth.user)
  oauths: UserOauth[];

  @OneToMany(() => Price, (price) => price.user)
  prices: Price[];

  @OneToMany(() => Wishlist, (wishlist) => wishlist.user)
  wishlists: Wishlist[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
