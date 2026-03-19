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

## 금지사항

- `@PrimaryGeneratedColumn()` (auto-increment) 사용 금지 → uuid만 사용
- Entity 파일에 비즈니스 로직 금지
- `synchronize: true`는 개발 환경 전용
