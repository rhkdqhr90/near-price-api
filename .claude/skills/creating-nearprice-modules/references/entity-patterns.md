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

## 🚫 신뢰도 시스템 Entity

신뢰도 시스템 Entity(PriceVerification, UserTrustScore, BadgeDefinition, UserBadge)는
**실제 Entity 파일과 `PROJECT.md` 스키마를 직접 참조할 것.**

> `src/price-verification/entities/price-verification.entity.ts`
> `src/trust-score/entities/`
> `src/badge/entities/`
>
> Reference 파일에 예시를 두지 않는 이유: 신뢰도 시스템은 구조가 복잡하고 자주 변경됨.
> 틀린 예시가 올바른 규칙보다 더 위험하기 때문에 원본 파일을 직접 읽어서 파악한다.

## 금지사항

- `@PrimaryGeneratedColumn()` (auto-increment) 사용 금지 → uuid만 사용
- Entity 파일에 비즈니스 로직 금지 (getter는 최소한으로)
- `synchronize: true`는 개발 환경 전용 (프로덕션 금지)
- nullable decimal의 from 변환에서 null 체크 필수
- unique 제약을 명시하지 않고 간과 금지
