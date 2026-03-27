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
import { Store } from '../../store/entities/store.entity';
import { Product } from '../../product/entities/product.entity';

// 상품별 활성 가격 조회 (product_id + isActive 필터링 후 price ASC 정렬)
@Index(['product', 'isActive', 'price'])
@Entity('prices')
export class Price {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.prices, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @ManyToOne(() => Store, (store) => store.prices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @ManyToOne(() => Product, (product) => product.prices, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'int' })
  price: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 3,
    nullable: true,
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | null) => (v === null ? null : parseFloat(v)),
    },
  })
  quantity: number | null;

  // 사진 필수 (신뢰도의 핵심)
  @Column()
  imageUrl: string;

  // 세일 기간
  @Column({ type: 'date', nullable: true })
  saleStartDate: Date | null;

  @Column({ type: 'date', nullable: true })
  saleEndDate: Date | null;

  // 제품 상태
  @Column({ nullable: true })
  condition: string | null;

  @Column({ default: true })
  isActive: boolean;

  // 좋아요 수
  @Column({ type: 'int', default: 0 })
  likeCount: number;

  // 신고 수
  @Column({ type: 'int', default: 0 })
  reportCount: number;

  // 신뢰도 점수 시스템
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | null) => (v === null ? null : parseFloat(v)),
    },
  })
  trustScore: number | null;

  @Column({ type: 'int', default: 0 })
  verificationCount: number;

  @Column({ type: 'int', default: 0 })
  confirmedCount: number;

  @Column({ type: 'int', default: 0 })
  disputedCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
