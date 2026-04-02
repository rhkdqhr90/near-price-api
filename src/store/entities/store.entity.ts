import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
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

// 커스텀 카테고리도 지원하는 타입
export type StoreTypeValue = StoreType | string;

@Entity('stores')
@Index(['latitude', 'longitude'])
export class Store {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({
    type: 'varchar', // enum 대신 varchar로 변경하여 커스텀 카테고리 지원
  })
  type: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 7,
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | null) => (v === null ? null : parseFloat(v)),
    },
  })
  latitude: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 7,
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | null) => (v === null ? null : parseFloat(v)),
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
