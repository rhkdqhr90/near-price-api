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
import { UnitType } from '../../product/entities/unit-type.enum';

/**
 * 가격표(PriceTag) 타입 시스템
 * - normal: 일반가 (기본)
 * - sale: 할인가 (원가 취소선 + 할인율)
 * - special: 특가 (시스템 판정 또는 등록자 지정)
 * - closing: 마감할인 (시간 한정)
 * - bundle: 1+1 / 2+1 / 3+1 묶음
 * - flat: 균일가 (그룹명 표시)
 * - member: 회원가
 * - cardPayment: 특정 카드 결제 시 할인
 */
export type PriceTagType =
  | 'normal'
  | 'sale'
  | 'special'
  | 'closing'
  | 'bundle'
  | 'flat'
  | 'member'
  | 'cardPayment';

export type BundleType = '1+1' | '2+1' | '3+1';
export type CardDiscountType = 'amount' | 'percent';

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

  @Column({
    type: 'enum',
    enum: UnitType,
    default: UnitType.OTHER,
  })
  unitType: UnitType;

  // 사진 필수 (신뢰도의 핵심)
  @Column()
  imageUrl: string;

  // 세일 기간
  @Column({ type: 'date', nullable: true })
  saleStartDate: Date | null;

  @Column({ type: 'date', nullable: true })
  saleEndDate: Date | null;

  // 제품 상태
  @Column({ type: 'varchar', nullable: true })
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

  // ───── 가격표(PriceTag) 시스템 ──────────────────────────────
  // 등록자가 지정하는 가격표 타입. 기본값 'normal'.
  @Column({
    type: 'varchar',
    length: 20,
    default: 'normal',
  })
  priceTagType: PriceTagType;

  // 원가 (sale / closing / cardPayment 타입에서 취소선 표시용)
  @Column({ type: 'int', nullable: true })
  originalPrice: number | null;

  // bundle 타입: '1+1' | '2+1' | '3+1'
  @Column({ type: 'varchar', length: 10, nullable: true })
  bundleType: BundleType | null;

  // bundle 타입: 묶음 수량 (예: 1+1일 때 2)
  @Column({ type: 'int', nullable: true })
  bundleQty: number | null;

  // flat 타입: 균일가 그룹명 (예: "5000원 균일")
  @Column({ type: 'varchar', length: 50, nullable: true })
  flatGroupName: string | null;

  // member 타입: 비회원 기준가 (비교 표시용)
  @Column({ type: 'int', nullable: true })
  memberPrice: number | null;

  // closing 타입: 마감 시각
  @Column({ type: 'timestamp', nullable: true })
  endsAt: Date | null;

  // cardPayment 타입: 카드명 자유 입력 (예: "신한카드", "현대 M포인트")
  // 카드사 BI 직접 사용 회피 위해 enum 대신 자유 텍스트.
  @Column({ type: 'varchar', length: 50, nullable: true })
  cardLabel: string | null;

  // cardPayment 타입: 할인 타입 ('amount' | 'percent')
  @Column({ type: 'varchar', length: 10, nullable: true })
  cardDiscountType: CardDiscountType | null;

  // cardPayment 타입: 할인 값 (amount: 원 / percent: %)
  @Column({ type: 'int', nullable: true })
  cardDiscountValue: number | null;

  // cardPayment 타입: 조건 메모 (예: "3만원 이상 결제 시")
  @Column({ type: 'varchar', length: 100, nullable: true })
  cardConditionNote: string | null;

  // 등록자 자유 메모 (전 타입 공통, 예: "1인 2개 한정")
  @Column({ type: 'varchar', length: 200, nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
