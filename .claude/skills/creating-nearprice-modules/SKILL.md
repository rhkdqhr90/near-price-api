---
name: creating-nearprice-modules
description: Generates NestJS modules following NearPrice project conventions. Creates entities, DTOs, services, controllers with enforced patterns. Use when creating new modules, adding new API endpoints, defining entities, or writing DTOs in the NearPrice backend.
---

# NearPrice NestJS 모듈 생성 규칙

이 프로젝트는 고유한 컨벤션이 있다. 일반적인 NestJS 패턴과 다른 부분이 있으니 반드시 따를 것.
작업 전 `CLAUDE.md`의 Section 2(비즈니스 규칙)와 Section 3(절대 변경 금지)를 확인한다.

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
3. **`@JoinColumn({ name: 'snake_case_col' })` 명시** — 모든 `@ManyToOne`, `@OneToOne`에 적용

### Decimal 컬럼
4. **decimal 컬럼 transformer 필수** — PostgreSQL string → number 변환
   ```typescript
   transformer: {
     from: (v: string | null) => v !== null ? parseFloat(v) : null,
     to: (v: number | null) => v,
   }
   ```

### DTO & 응답
5. **ResponseDto 분리** — Entity 직접 반환 금지
   ```typescript
   return PriceResponseDto.from(entity);
   ```

6. **DTO class-validator 전부 적용** — 모든 필드에 데코레이터
   ```typescript
   @IsUUID() storeId: string;
   @IsNumber() price: number;
   @Type(() => Date) @IsDate() saleEndDate?: Date;
   ```

   **TypeScript strict init 대응**: DTO의 필수 필드는 `!` definite assignment 사용
   ```typescript
   @IsString()
   @IsNotEmpty()
   name!: string;
   ```

### 아키텍처
7. **Controller는 thin** — 로직 없이 Service 호출만
8. **findOne 실패 시 NotFoundException** — null 반환 금지
9. **SQL injection 방지** — QueryBuilder 파라미터 바인딩 필수
10. **LIKE/ILIKE에 ESCAPE 절** — `%`, `_` 와일드카드 이스케이프 필수
    ```typescript
    const escaped = input.replace(/%/g, '\\%').replace(/_/g, '\\_');
    .where('col LIKE :pattern ESCAPE :escape', { pattern: `%${escaped}%`, escape: '\\' })
    ```

### FCM / 비동기
11. **FCM 발송은 fire-and-forget** — `.catch()` 에러 로깅 포함
    ```typescript
    this.notificationService.sendToUser(...)
      .catch((err: unknown) => this.logger.warn('알림 실패', (err as Error)?.message));
    ```
12. **대량 FCM 발송 시 배치 처리** — 500명 청크, 전체 유저 일괄 로드 금지

## 신뢰도 시스템 관련 규칙 (중요)

- **`User.trustScore`를 직접 업데이트하는 메서드 추가 금지** — `TrustScoreScheduler`만 단일 writer (매일 03:00 배치)
- 신규 모듈에서 검증/반응 이벤트 발생 시 trustScore 즉시 재계산 로직 추가 금지

## 패턴 상세

Entity, DTO, Service, Controller 각 패턴의 구체적 코드는 `references/` 디렉토리를 참조:

- `references/entity-patterns.md` — Entity 템플릿, decimal transformer, 관계 설정
- `references/dto-patterns.md` — DTO 분리 규칙, class-validator, @Type 변환
- `references/service-patterns.md` — CRUD 패턴, return await, 에러 핸들링
