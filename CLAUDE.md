# NearPrice Backend (near-price-api)

## 프로젝트 개요
크라우드소싱 기반 동네 마트/시장 가격 비교 API.
핵심 가치: "내가 살 거 제일 싼 데가 어디야"
사용자 플로우: 상품 검색 → 가격 순위 → 매장 위치

## 기술 스택
- NestJS + TypeScript
- TypeORM + PostgreSQL 14 (Postgres.app, DB명: nearprice)
- class-validator + class-transformer
- 패키지 매니저: npm (pnpm/yarn 사용 금지)

## 아키텍처
- Layered Architecture: Controller → Service → Repository → Entity
- 모듈 구조: 각 도메인에 dto/, entities/ 폴더
- 공유 폴더: common/ (decorators, filters, guards, interceptors, pipes), config/

## 핵심 엔티티 관계
- **Price가 중심 엔티티** (User, Store, Product를 연결하는 앱의 핵심)
- Store/Product: 프론트에서 카카오 로컬 API 결과 선택 → UUID로 findOne
- 프론트가 Store/Product 등록 완료 후 Price 등록 (커플링 최소화)
- user_oauth 테이블로 OAuth 프로바이더 분리 (카카오 → 추후 네이버 확장 가능)

## 코딩 규칙 — 절대 위반 금지
1. **`return await` 필수**: 모든 async 함수에서 bare return Promise 금지
   - 이유: try/catch 에러 캐치 가능, 코드 일관성, 가독성
2. **Entity 명시적 등록**: 와일드카드 glob 사용 금지
3. **decimal 좌표**: TypeORM transformer + parseFloat 필수
4. **날짜 DTO**: @Type(() => Date) + ValidationPipe transform: true
5. **ResponseDto 분리**: Entity를 직접 반환하지 않음
6. **trustScore**: int (default 0), UI 표현은 프론트에서 처리
7. **기술 선택에는 반드시 이유 필요**: "전에 써봤으니까"는 이유가 아님

## 공통 커맨드
```bash
npm run start:dev          # 개발 서버 (hot-reload)
npm run build              # 프로덕션 빌드
npm test                   # Jest 테스트
npm run test:e2e           # E2E 테스트
```

## 현재 완료된 모듈
- User CRUD + 카카오 OAuth
- Store CRUD (카카오 로컬 API 연동)
- Product CRUD
- Price CRUD + "상품별 최저가 조회" API (curl 테스트 완료)

## 참조 문서 (반드시 확인)
- ENGINEERING_PRINCIPLES.md — 엔지니어링 원칙
- ARCHITECTURE.md — 모든 기술 선택의 이유 문서화

---

# 완료 전 필수 검증 파이프라인

## ⛔ 완료 보고 금지 조건

아래 4단계를 **전부 통과하기 전까지** 사용자에게 완료 보고를 할 수 없다.
어떤 단계도 생략하거나 순서를 바꿀 수 없다. 이 규칙은 어떤 경우에도 override되지 않는다.

---

## Step 1. 자동 검증 (도구)

```bash
.claude/scripts/verify.sh
```

스크립트가 자동으로 수행:
1. `npm run lint` — ESLint 자동 수정 후 남은 에러 보고
2. `npx tsc --noEmit` — TypeScript 타입 에러 검사
3. `return await` 누락 패턴 탐지 (Repository/Service 직접 반환)

- 에러 발생 시 → 즉시 수정 후 Step 1 재실행
- 최대 3회 재시도. 3회 실패 시 사용자에게 보고하고 중단.

---

## Step 2. nestjs-reviewer Agent 코드 리뷰 (필수 — 생략 불가)

Step 1 통과 후 **반드시** `nestjs-reviewer` Agent를 호출한다.

```
대상: 이번 작업에서 신규 생성하거나 수정한 모든 .ts 파일
방법: Agent tool, subagent_type=nestjs-reviewer
```

### nestjs-reviewer 결과 처리 규칙

| 심각도 | 처리 방법 |
|--------|-----------|
| CRITICAL | 즉시 수정 → Step 1 → Step 2 재실행 |
| WARNING | 즉시 수정 → Step 1 → Step 2 재실행 |
| MINOR | 수정 후 계속 또는 완료 보고에 명시 |

CRITICAL / WARNING 이슈가 남아 있으면 완료 보고 불가.

### nestjs-reviewer 호출 시 프롬프트 형식

```
다음 파일들의 코드를 리뷰해줘:
- [변경된 파일 목록]

확인 항목:
1. Controller thin 여부 (로직이 Service에 있는가)
2. Repository 접근 위치 (Controller에서 직접 접근 금지)
3. DTO 3종 분리 (Create / Update / Response)
4. return await 누락 여부
5. Entity 명시적 등록 여부
6. decimal 컬럼 transformer + parseFloat 여부
7. findOne null 결과 → NotFoundException 처리
8. class-validator 데코레이터 적용 여부
9. 민감 정보 로깅 여부
10. 인증/권한 가드 누락 여부
```

---

## Step 3. 자체 검토 체크리스트

nestjs-reviewer 통과 후 변경 파일 기준으로 직접 확인:

1. [ ] return await 있는가? (모든 async 함수)
2. [ ] Entity 명시적 등록 (glob 패턴 금지)?
3. [ ] decimal 컬럼에 transformer + parseFloat?
4. [ ] DTO @Type(() => Date) + transform: true?
5. [ ] ResponseDto 분리? (Entity 직접 반환 금지)
6. [ ] findOne null 처리 → NotFoundException?
7. [ ] 권한 체크 ForbiddenException?
8. [ ] class-validator 데코레이터 전부 적용?
9. [ ] 민감 정보 로깅 없는가?
10. [ ] code-review-checklist.md 아키텍처/보안/성능 항목 확인했는가?

하나라도 실패 시 수정 후 Step 1부터 재실행.

---

## Step 4. 완료 보고

아래 형식 그대로 보고. `nestjs-reviewer` 항목이 없으면 보고 무효.

```
✅ 구현 완료

변경 파일:
- src/price/price.service.ts (수정)
- src/price/dto/create-price.dto.ts (신규)

검증 결과:
- ESLint: ✅ 통과
- TypeScript: ✅ 통과
- return await 규칙: ✅ 통과
- nestjs-reviewer: ✅ CRITICAL 0건 / WARNING 0건 / MINOR n건

자체 검토:
- 코딩 규칙 10개 전부 준수
- DTO 3종 분리 확인
- 에러 처리 패턴 확인
```

---

## 자동 수정 규칙

- 각 단계 실패 시 스스로 에러를 분석하고 수정한다
- Step 1~2 최대 3회 재시도. 3회 실패 시 사용자에게 보고하고 중단
- 수정할 때 기존 코드의 의도를 훼손하지 않는다

## 작업 범위 규칙
- 프롬프트에 명시된 파일만 수정한다. 목록에 없는 파일은 절대 건드리지 않는다.
- 자체 판단 리팩토링 금지. 요청받은 작업만 수행한다.
- 리팩토링이 필요하다고 판단되면 수정하지 말고 보고만 한다.
