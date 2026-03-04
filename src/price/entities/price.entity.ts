import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Store } from '../../store/entities/store.entity';
import { Product } from '../../product/entities/product.entity';

@Entity('prices')
export class Price {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.prices, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

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

  @Column({ type: 'decimal', nullable: true })
  quantity: number;

  // 사진 필수 (신뢰도의 핵심)
  @Column()
  imageUrl: string;

  // 세일 기간
  @Column({ type: 'date', nullable: true })
  saleStartDate: Date;

  @Column({ type: 'date', nullable: true })
  saleEndDate: Date;

  // 제품 상태
  @Column({ nullable: true })
  condition: string;

  // 좋아요 수
  @Column({ type: 'int', default: 0 })
  likeCount: number;

  // 신고 수
  @Column({ type: 'int', default: 0 })
  reportCount: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
