import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Price } from '../../price/entities/price.entity';
import { Wishlist } from '../../wishlist/entities/wishlist.entity';

export enum ProductCategory {
  VEGETABLE = 'vegetable', // 채소
  FRUIT = 'fruit', // 과일
  MEAT = 'meat', // 육류
  SEAFOOD = 'seafood', // 수산물
  DAIRY = 'dairy', // 유제품
  GRAIN = 'grain', // 곡류
  PROCESSED = 'processed', // 가공식품
  HOUSEHOLD = 'household', // 생활용품
  OTHER = 'other', // 기타
}

// UnitType enum은 Price 엔티티로 이관됨. 별도 파일에서 re-export (하위 호환).
export { UnitType } from './unit-type.enum';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: ProductCategory,
  })
  category: ProductCategory;

  @OneToMany(() => Price, (price) => price.product)
  prices: Price[];

  @OneToMany(() => Wishlist, (wishlist) => wishlist.product)
  wishlists: Wishlist[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
