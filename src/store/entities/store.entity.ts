import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Price } from '../../price/entities/price.entity';

export enum StoreType {
  LARGE_MART = 'large_mart', // 대형마트 (이마트, 코스트코, 홈플러스)
  MART = 'mart', // 중소형 마트
  SUPERMARKET = 'supermarket', // 슈퍼마켓
  CONVENIENCE = 'convenience', // 편의점
  TRADITIONAL_MARKET = 'traditional_market', // 전통시장
}

@Entity('stores')
export class Store {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: StoreType,
  })
  type: StoreType;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 7,
    transformer: {
      to: (v: number) => v,
      from: (v: string) => parseFloat(v),
    },
  })
  latitude: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 7,
    transformer: {
      to: (v: number) => v,
      from: (v: string) => parseFloat(v),
    },
  })
  longitude: number;

  @Column()
  address: string;

  // 외부 API 매장 고유 ID (선택, 커스텀 매장은 null)
  @Column({ type: 'varchar', unique: true, nullable: true })
  externalPlaceId: string | null;

  @OneToMany(() => Price, (price) => price.store)
  prices: Price[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
