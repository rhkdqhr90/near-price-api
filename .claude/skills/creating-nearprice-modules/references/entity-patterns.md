# Entity 패턴

## 기본 구조

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn
} from 'typeorm';

@Entity('<table_name>')
export class <Name> {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

## decimal 컬럼 (좌표, 가격 등)

반드시 transformer 적용. PostgreSQL이 string으로 반환하기 때문.

```typescript
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
```

nullable decimal:
```typescript
@Column({
  type: 'decimal',
  precision: 10,
  scale: 2,
  nullable: true,
  transformer: {
    to: (v: number | null) => v,
    from: (v: string | null) => (v !== null ? parseFloat(v) : null),
  },
})
quantity: number | null;
```

## 관계 설정

Price가 앱의 중심 엔티티. 관계 설정 시 JoinColumn 명시적 사용.

```typescript
@ManyToOne(() => Store, (store) => store.prices, { nullable: false })
@JoinColumn({ name: 'store_id' })
store: Store;
```

## 신뢰도 시스템 Entity 예제 (NEW)

### PriceVerification Entity
```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Price } from '../price/entities/price.entity';
import { User } from '../user/entities/user.entity';

export enum VerificationResult {
  MATCH = 'MATCH',           // 가격이 맞음
  DIFFERENT = 'DIFFERENT',   // 가격이 다름
}

@Entity('price_verification')
@Index(['priceId', 'userId'], { unique: true }) // 1사용자 1투표
@Index(['priceId', 'result']) // 가격별 검증 조회 최적화
export class PriceVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Price, (price) => price.verifications, { nullable: false })
  @JoinColumn({ name: 'price_id' })
  price: Price;

  @Column('uuid')
  priceId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column('uuid')
  userId: string;

  @Column({
    type: 'enum',
    enum: VerificationResult,
  })
  result: VerificationResult;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### TrustScore Entity
```typescript
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../user/entities/user.entity';

export enum BadgeLevel {
  BRONZE = 'BRONZE',         // 0-24
  SILVER = 'SILVER',         // 25-49
  GOLD = 'GOLD',             // 50-74
  PLATINUM = 'PLATINUM',     // 75-100
}

@Entity('trust_score')
export class TrustScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (user) => user.trustScore, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column('uuid', { unique: true })
  userId: string;

  @Column({ type: 'int', default: 0 })
  totalVerifications: number; // 총 검증 수

  @Column({ type: 'int', default: 0 })
  matchVerifications: number; // 맞아요 수

  @Column({
    type: 'int',
    default: 0,
    transformer: {
      from: (v: number) => v,
      to: (v: number) => Math.min(100, Math.max(0, v)), // 0~100 범위
    },
  })
  trustScore: number; // 0~100 (계산값)

  @Column({
    type: 'enum',
    enum: BadgeLevel,
    default: BadgeLevel.BRONZE,
  })
  level: BadgeLevel; // 등급

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### Badge Entity
```typescript
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { BadgeLevel } from './trust-score.entity';

@Entity('badge')
export class Badge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (user) => user.badge, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column('uuid', { unique: true })
  userId: string;

  @Column({
    type: 'enum',
    enum: BadgeLevel,
    default: BadgeLevel.BRONZE,
  })
  level: BadgeLevel;

  @CreateDateColumn()
  createdAt: Date;
}
```

## 금지사항

- `@PrimaryGeneratedColumn()` (auto-increment) 사용 금지 → uuid만 사용
- Entity 파일에 비즈니스 로직 금지 (getter는 최소한으로)
- `synchronize: true`는 개발 환경 전용 (프로덕션 금지)
- nullable decimal의 from 변환에서 null 체크 필수
- unique 제약을 명시하지 않고 간과 금지
