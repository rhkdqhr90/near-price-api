---
name: creating-nearprice-modules
description: Generates NestJS modules following NearPrice project conventions. Creates entities, DTOs, services, controllers with enforced patterns. Use when creating new modules, adding new API endpoints, defining entities, or writing DTOs in the NearPrice backend.
---

# NearPrice NestJS 모듈 생성 규칙

이 프로젝트는 고유한 컨벤션이 있다. 일반적인 NestJS 패턴과 다른 부분이 있으니 반드시 따를 것.

## 디렉토리 구조

```
src/<module-name>/
  dto/
    create-<name>.dto.ts
    update-<name>.dto.ts
    <name>-response.dto.ts
  entities/
    <name>.entity.ts
  <name>.controller.ts
  <name>.service.ts
  <name>.module.ts
```

## 절대 규칙 (위반 시 리뷰 탈락)

### 비동기 처리
1. **`return await` 필수** — 모든 async 메서드에서 bare return Promise 금지
   ```typescript
   // ✅ 필수
   return await this.repository.findOne({ ... });

   // ❌ 금지
   return this.repository.findOne({ ... });
   ```

### Entity & 모듈
2. **Entity 명시적 등록** — TypeOrmModule.forFeature() glob 금지
   ```typescript
   // ✅ 필수
   TypeOrmModule.forFeature([Price, Store, Product, User])

   // ❌ 금지
   TypeOrmModule.forFeature([...entities]) // auto glob
   ```

### Decimal 컬럼
3. **decimal 컬럼 transformer 필수** — PostgreSQL string → number 변환
   ```typescript
   transformer: {
     from: (v: string | null) => v !== null ? parseFloat(v) : null,
     to: (v: number | null) => v,
   }
   ```

### DTO & 응답
4. **ResponseDto 분리** — Entity 직접 반환 금지
   ```typescript
   // ✅ 필수
   return PriceResponseDto.from(entity);

   // ❌ 금지
   return entity; // Entity 직접 반환
   ```

5. **DTO class-validator 전부 적용** — 모든 필드에 데코레이터
   ```typescript
   @IsUUID() storeId: string;
   @IsNumber() price: number;
   @Type(() => Date) @IsDate() saleEndDate?: Date;
   ```

### 아키텍처
6. **Controller는 thin** — 로직 없이 Service 호출만
   ```typescript
   // ✅ 필수
   @Post()
   async create(@Body() dto: CreatePriceDto): Promise<ResponseDto> {
     return await this.service.create(dto);
   }

   // ❌ 금지
   @Post()
   async create(@Body() dto: CreatePriceDto): Promise<ResponseDto> {
     const entity = new Price(); // 로직 금지
     entity.price = dto.price;
     // ...
   }
   ```

7. **findOne 실패 시 NotFoundException** — null 반환 금지
   ```typescript
   if (!entity) {
     throw new NotFoundException(`${id} not found`);
   }
   ```

### 보안 (OWASP)
8. **SQL injection 방지** — 파라미터 바인딩 필수
   ```typescript
   // ✅ 안전
   .where('price.storeId = :id', { id: storeId })

   // ❌ 위험
   .where(`price.storeId = '${storeId}'`)
   ```

9. **민감 정보 로깅 금지** — 토큰, 비밀번호, 개인정보
   ```typescript
   // ❌ 금지
   console.log('Token:', jwtToken);
   ```

10. **권한 검증** — 타인 리소스 접근 방지
    ```typescript
    if (price.userId !== requestUserId && !isAdmin) {
      throw new ForbiddenException();
    }
    ```

## 신뢰도 시스템 패턴 (NEW)

### PriceVerification 모듈
- **엔티티**: PriceVerification (price:user = N:1)
- **DTO**: CreateVerificationDto, VerificationResponseDto
- **검증 로직**:
  - 본인이 등록한 가격은 검증 불가
  - 1사용자 1투표만 허용 (중복 검증 방지)
  - 검증 결과: MATCH / DIFFERENT

### TrustScore 모듈
- **엔티티**: TrustScore (user = 1:1)
- **계산 공식**: `trustScore = (matchCount / totalCount) * 100`
- **레벨**: BRONZE (0-24) / SILVER (25-49) / GOLD (50-74) / PLATINUM (75-100)
- **트리거**: PriceVerification 추가/삭제 시 자동 갱신

### Badge 모듈
- **엔티티**: Badge (user = 1:1)
- **부여 시점**: TrustScore 레벨 변경 시
- **로직**: TrustScore 변경 후 Badge 업데이트

## 패턴 상세

Entity, DTO, Service, Controller 각 패턴의 구체적 코드는 `references/` 디렉토리를 참조:

- `references/entity-patterns.md` — Entity 템플릿, decimal transformer, 관계 설정
- `references/dto-patterns.md` — DTO 분리 규칙, class-validator, @Type 변환
- `references/service-patterns.md` — CRUD 패턴, return await, 에러 핸들링
