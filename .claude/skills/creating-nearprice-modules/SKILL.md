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

1. **`return await` 필수** — 모든 async 메서드에서 bare return Promise 금지
2. **Entity 명시적 등록** — TypeOrmModule.forFeature()에 glob 금지
3. **decimal 컬럼 transformer 필수** — `from: (v: string) => parseFloat(v)`
4. **ResponseDto 분리** — Entity 직접 반환 금지
5. **Controller는 thin** — 로직 없이 Service 호출만
6. **findOne 실패 시 NotFoundException** — null 반환 금지

## 패턴 상세

Entity, DTO, Service, Controller 각 패턴의 구체적 코드는 `references/` 디렉토리를 참조:

- `references/entity-patterns.md` — Entity 템플릿, decimal transformer, 관계 설정
- `references/dto-patterns.md` — DTO 분리 규칙, class-validator, @Type 변환
- `references/service-patterns.md` — CRUD 패턴, return await, 에러 핸들링
