# Service 패턴

## 핵심: return await 필수

모든 async 메서드에서 `return await` 사용. bare return Promise 절대 금지.

```typescript
// ✅ 올바름
async findOne(id: string): Promise<n> {
  const entity = await this.repository.findOne({ where: { id } });
  if (!entity) {
    throw new NotFoundException(`${id} not found`);
  }
  return await entity;
}

// ❌ 금지 — try/catch에서 에러 캐치 불가
async findOne(id: string): Promise<n> {
  return this.repository.findOne({ where: { id } });
}
```

## create 패턴

save 후 관계 포함 재조회.

```typescript
async create(dto: Create<n>Dto): Promise<n> {
  // FK 검증: 관련 엔티티 존재 확인
  const store = await this.storeRepository.findOne({ where: { id: dto.storeId } });
  if (!store) {
    throw new NotFoundException(`Store ${dto.storeId} not found`);
  }

  const entity = this.repository.create({ ...dto, store });
  const saved = await this.repository.save(entity);

  // 관계 포함 재조회
  return await this.repository.findOne({
    where: { id: saved.id },
    relations: ['store', 'product', 'user'],
  });
}
```

## update 패턴

스프레드 병합 금지. FK와 스칼라 필드 분리.

```typescript
async update(id: string, dto: Update<n>Dto): Promise<n> {
  const entity = await this.repository.findOne({
    where: { id },
    relations: ['store', 'product', 'user'],
  });
  if (!entity) {
    throw new NotFoundException(`${id} not found`);
  }

  // FK 변경이 있으면 별도 처리
  const { storeId, productId, ...scalarFields } = dto as any;
  if (storeId) {
    const store = await this.storeRepository.findOne({ where: { id: storeId } });
    if (!store) throw new NotFoundException(`Store ${storeId} not found`);
    entity.store = store;
  }

  // 스칼라 필드만 병합
  Object.assign(entity, scalarFields);
  const saved = await this.repository.save(entity);

  return await this.repository.findOne({
    where: { id: saved.id },
    relations: ['store', 'product', 'user'],
  });
}
```

## findOne / findAll 패턴

```typescript
// findOne — 없으면 NotFoundException
async findOne(id: string): Promise<n> {
  const entity = await this.repository.findOne({
    where: { id },
    relations: ['store', 'product', 'user'],
  });
  if (!entity) {
    throw new NotFoundException(`${id} not found`);
  }
  return await entity;
}

// findAll — 빈 배열 허용
async findAll(): Promise<n[]> {
  return await this.repository.find({
    relations: ['store', 'product', 'user'],
  });
}
```

## Controller 패턴 (thin)

```typescript
@Get(':id')
async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ResponseDto> {
  return await this.service.findOne(id);
}
```

ParseUUIDPipe 필수 — 잘못된 UUID 입력 시 400 반환.

## 금지사항

- Controller에 비즈니스 로직 금지
- Repository 직접 접근 금지 (Controller → Service → Repository)
- silent error swallowing 금지 (빈 catch 블록)
- findOne에서 null 반환 금지 → NotFoundException throw
