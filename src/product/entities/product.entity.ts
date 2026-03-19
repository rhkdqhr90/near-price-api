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

export enum UnitType {
  GRAM = 'g',
  KILOGRAM = 'kg',
  MILLILITER = 'ml',
  LITER = 'l',
  COUNT = 'count', // 개
  BUNCH = 'bunch', // 묶음
  PACK = 'pack', // 팩
  BAG = 'bag', // 망
  OTHER = 'other', // 기타 (사진으로 판단)
}

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

  @Column({
    type: 'enum',
    enum: UnitType,
    default: UnitType.OTHER,
  })
  unitType: UnitType;

  @OneToMany(() => Price, (price) => price.product)
  prices: Price[];

  @OneToMany(() => Wishlist, (wishlist) => wishlist.product)
  wishlists: Wishlist[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
