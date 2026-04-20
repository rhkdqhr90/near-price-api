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
import { User } from '../../user/entities/user.entity';

/**
 * 알림 타입.
 * - priceVerified: 내가 등록한 가격을 다른 유저가 확인
 * - priceDisputed: 내가 등록한 가격에 이견 제기
 * - newNearbyPrice: 관심 상품의 새 최저가 등록
 * - wishlistLowered: 찜한 상품 가격 하락
 * - system: 시스템 공지 (릴리즈, 공지사항 등)
 */
export type NotificationType =
  | 'priceVerified'
  | 'priceDisputed'
  | 'newNearbyPrice'
  | 'wishlistLowered'
  | 'system';

/**
 * 딥링크 대상 타입.
 * linkId는 해당 엔티티의 UUID. linkType=url인 경우만 절대 URL 문자열.
 */
export type NotificationLinkType =
  | 'price'
  | 'product'
  | 'store'
  | 'notice'
  | 'url';

@Entity('notifications')
// 사용자별 미읽음 조회 + 최신순 정렬용 복합 인덱스
@Index(['user', 'isRead', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 30 })
  type: NotificationType;

  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ type: 'varchar', length: 300 })
  body: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  linkType: NotificationLinkType | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  linkId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  @Column({ default: false })
  isRead: boolean;

  @Column({ type: 'timestamp', nullable: true })
  readAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
