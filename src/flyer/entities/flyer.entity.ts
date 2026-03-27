import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface FlyerProductItem {
  id: string;
  name: string;
  emoji: string;
  originalPrice: number | null;
  salePrice: number;
  badges: Array<{ label: string; type: 'red' | 'yellow' | 'blue' }>;
}

export interface FlyerReviewItem {
  id: string;
  name: string;
  initial: string;
  meta: string;
  content: string;
  helpfulCount?: number;
  avatarColor: string;
}

@Entity('flyers')
export class Flyer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  storeName: string;

  /** 프로모션 타이틀 (예: "파격 특가", "봄 신상 출시") */
  @Column()
  promotionTitle: string;

  @Column()
  badge: string;

  @Column()
  badgeColor: string;

  @Column()
  dateRange: string;

  /** 목록용 한줄 요약 */
  @Column()
  highlight: string;

  @Column({ default: '#F5EDD8' })
  bgColor: string;

  @Column({ default: '🛒' })
  emoji: string;

  @Column({ nullable: true })
  warningText: string;

  @Column({ type: 'text', nullable: true })
  ownerQuote: string;

  @Column({ nullable: true })
  ownerName: string;

  @Column({ nullable: true })
  ownerRole: string;

  @Column({ nullable: true })
  storeAddress: string;

  @Column({
    type: 'decimal',
    precision: 3,
    scale: 1,
    nullable: true,
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | null) => (v === null ? null : parseFloat(v)),
    },
  })
  storeRating: number | null;

  @Column({ type: 'int', nullable: true })
  storeReviewCount: number | null;

  @Column({ type: 'simple-json', nullable: true })
  products: FlyerProductItem[] | null;

  @Column({ type: 'simple-json', nullable: true })
  reviews: FlyerReviewItem[] | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
