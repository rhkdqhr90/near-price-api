# CLAUDE.md — AI 작업 컨텍스트 가이드 (마실앱 백엔드)

> **AI가 이 프로젝트에서 작업을 시작하기 전 반드시 먼저 읽어야 하는 파일입니다.**
> 이 파일에 정의된 규칙과 결정 사항을 무시하거나 임의로 변경하지 마세요.

---

## 1. 앱 개요 및 핵심 목적

**앱 이름**: 마실앱 (프로젝트명: near-price-api)

**목적**: 오프라인 최저가 비교 서비스
- 사용자가 마트·편의점·전통시장 등에서 상품 가격을 사진으로 찍어 공유
- GPS 기반으로 동네 반경(3/5/10km) 내 매장의 최저가 정보를 제공
- 인터넷 쇼핑에 대응하는 오프라인 상권 활성화가 궁극적 목표

**핵심 가치**: "내가 살 거 제일 싼 데가 어디야"
**사용자 플로우**: 상품 검색 → 가격 순위 → 매장 위치 확인

**서비스 구성**:
- 백엔드: NestJS (이 레포지토리, `near-price-api`)
- 모바일 앱: Android (`near-price-app`)
- 어드민: 별도 프로젝트 (`near-price-admin`)

---

## 2. 비즈니스 규칙 — 의도적 설계 결정 목록

아래 항목들은 "버그처럼 보이지만 실제로는 의도된 설계"입니다. 수정하거나 제거하지 마세요.

### 🔴 절대 변경 금지: 일반 유저 매장 등록

```typescript
// store.controller.ts
@Post()
@UseGuards(JwtAuthGuard)           // AdminGuard 없음 — 의도적 설계
@Throttle({ write: { limit: 10, ttl: 60000 } })
async create(@Body() createStoreDto: CreateStoreDto) { ... }
```

**일반 유저가 매장을 자유롭게 등록할 수 있는 것은 정상 동작입니다.**

이유: 마실앱의 핵심 가치는 사용자 참여 기반의 데이터 수집입니다. 앱에 등록되지 않은 동네 마트도 사용자가 직접 추가할 수 있어야 서비스가 성장합니다. 매장 수정/삭제는 어드민만 가능하도록 `AdminGuard`로 보호하고 있습니다.

### 🟡 주의: 매장 타입(StoreType)이 `varchar`인 이유

```typescript
// store.entity.ts
@Column({ type: 'varchar' })  // enum 대신 varchar — 커스텀 카테고리 지원
type: string;
```

`StoreType` enum(LARGE_MART, MART, SUPERMARKET, CONVENIENCE, TRADITIONAL_MARKET)이 정의되어 있지만, 실제 컬럼 타입은 `varchar`입니다. 사용자가 등록한 커스텀 매장 타입(예: "철물점", "약국" 등)을 수용하기 위한 의도적 설계입니다.

### 🟡 주의: 가격 등록 시 사진(imageUrl) 필수

사진은 신뢰도 시스템의 핵심입니다. `imageUrl`은 NOT NULL 컬럼이며, 가격 등록 전에 `/upload` 엔드포인트로 먼저 이미지를 업로드해야 합니다. 사진 없는 가격 등록은 허용하지 않는 설계입니다.

### 🟡 주의: "달라요" 검증 시 자동으로 새 가격 생성

`PriceVerificationService.createVerification()`에서 `VerificationResult.DISPUTED` 결과를 제출하면, 검증자가 입력한 `actualPrice`로 새 가격 데이터가 자동 생성됩니다. 이는 가격 데이터의 자동 갱신을 위한 의도된 플로우입니다.

### 🟡 주의: 가격 등록자 계정 삭제 시 가격 데이터 유지

```typescript
// price.entity.ts
@ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
user: User | null;
```

사용자 탈퇴 시 해당 사용자의 가격 데이터는 삭제되지 않고 `user_id = NULL`로 익명화됩니다. 커뮤니티 데이터 보존을 위한 의도적 결정입니다.

### 🟡 주의: Refresh Token Rotation (Redis)

로그인할 때마다 Refresh Token을 Redis에 저장(`rt:{userId}`)하고 덮어씁니다. 새 토큰 발급 시 이전 토큰은 자동으로 무효화됩니다. Redis 미설정 환경에서는 토큰 검증을 스킵합니다(개발 편의).

### 🟡 주의: `synchronize: false` — 스키마는 마이그레이션으로만 변경

TypeORM `synchronize: false`로 설정되어 있습니다. Entity를 수정해도 DB 스키마가 자동 변경되지 않습니다. 반드시 마이그레이션 파일을 생성하고 실행해야 합니다.

---

## 3. AI 작업 시 절대 변경 금지 사항

1. **`POST /store` 에서 `AdminGuard` 추가 금지** — 일반 유저 매장 등록은 의도된 설계
2. **`Store.type` 컬럼을 `enum` 타입으로 변경 금지** — 커스텀 타입 지원을 위해 `varchar` 유지
3. **`Price.user` 관계의 `onDelete: 'SET NULL'` 변경 금지** — 탈퇴 후 익명화 정책
4. **`Price.imageUrl` nullable 허용 금지** — 사진 필수 정책
5. **`synchronize: false` 변경 금지** — 마이그레이션으로만 스키마 변경
6. **신뢰도 점수 계산 스케줄러 주기 임의 변경 금지** — 매일 새벽 3시 실행 (`0 3 * * *`)
7. **Rate Limit 전역 해제 금지** — 프로덕션 보안 필수 요소
8. **`return await` 생략 금지** — 모든 async 함수에서 bare return Promise 금지 (try/catch 에러 캐치 및 코드 일관성)
9. **`GET /naver/geocode`, `GET /naver/reverse-geocode` 에 `JwtAuthGuard` 추가 금지** — 비로그인 LocationSetupScreen(AuthStack)에서 호출하는 온보딩 필수 API. Throttle(`분당 20회`)로만 보호.
10. **`PriceReactionService`, `PriceVerificationService` 에서 `User.trustScore` 직접 업데이트 금지** — `TrustScoreScheduler`(매일 03:00)만 단일 writer. 즉시 재계산 메서드 추가 시 공식 충돌 및 덮어쓰기 발생.

---

## 4. 코드 수정 전 반드시 확인할 사항

### Entity 변경 시

- `synchronize: false` 이므로 Entity 수정 후 반드시 마이그레이션 파일 생성 필요
- 마이그레이션 생성: `npm run typeorm:migration:generate -- -n MigrationName`
- 마이그레이션 실행: `npm run typeorm:migration:run`

### 새 기능 추가 시

- Rate Limit 데코레이터(`@Throttle`) 적용 여부 확인
- 인증이 필요한 엔드포인트에 `@UseGuards(JwtAuthGuard)` 적용 여부 확인
- 어드민 전용 엔드포인트에 `@UseGuards(JwtAuthGuard, AdminGuard)` 모두 적용 확인
- ResponseDto 분리 여부 확인 (Entity를 직접 반환하지 않음)

### 파일 업로드 관련

- 업로드 엔드포인트(`POST /upload`)는 Magic Bytes 검증을 수행함 (MIME 스푸핑 방지)
- 허용 형식: JPEG, PNG, WebP (최대 10MB)
- 업로드 시 파일은 AWS S3에 저장되며, 반환된 URL을 Price의 `imageUrl`에 사용

### FCM 알림

- `NotificationService`는 `FIREBASE_SERVICE_ACCOUNT_JSON` 환경변수가 없으면 비활성화됨
- 알림은 fire-and-forget 패턴으로 처리 (실패해도 메인 로직에 영향 없음)
- 전단지(Flyer) FCM은 500명 청크 배치 처리 (`FlyerService.sendFlyerNotifications`) — OOM 이슈 해결 완료

### decimal 컬럼 (좌표, 가격 신뢰도 등)

모든 `decimal` 타입 컬럼에는 TypeORM transformer 적용 필수:

```typescript
transformer: {
  to: (v: number | null) => v,
  from: (v: string | null) => (v === null ? null : parseFloat(v)),
}
```

---

## 5. 주요 모듈별 역할 요약

| 모듈 | 역할 |
|------|------|
| `AuthModule` | Kakao OAuth 로그인, JWT 발급/갱신/무효화, 어드민 로그인 |
| `UserModule` | 사용자 프로필 조회/수정, 닉네임 변경(30일 제한), FCM 토큰 관리 |
| `StoreModule` | 매장 등록/검색/근처 조회 (Haversine 공식 GPS 거리 계산), 매장 리뷰 |
| `ProductModule` | 상품 등록/검색 (카테고리: 채소/과일/육류/수산물/유제품/곡류/가공식품/생활용품/기타) |
| `PriceModule` | 가격 등록/조회/최저가 카드 (품목별 DISTINCT ON 최저가), 찜 사용자 FCM 알림 |
| `PriceReactionModule` | 가격에 좋아요(confirm)/신고(report) 반응 (1인 1반응) |
| `PriceVerificationModule` | 가격 맞아요/달라요 검증, 달라요 시 새 가격 자동 생성, 24시간 중복 방지 |
| `TrustScoreModule` | 사용자·가격 신뢰도 점수 계산 (매일 03:00 배치, `@Cron('0 3 * * *')`) |
| `BadgeModule` | 뱃지 정의 관리 및 사용자 뱃지 부여 (카테고리: REGISTRATION/VERIFICATION/TRUST) |
| `WishlistModule` | 상품 찜하기/취소 |
| `UploadModule` | AWS S3 이미지 업로드 (Magic Bytes 검증 포함) |
| `NotificationModule` | Firebase FCM 알림 (단일/다중 500청크 발송, 만료 토큰 자동 정리) |
| `FlyerModule` | 소상공인 전단지 조회, OwnerPost 관리 |
| `NaverModule` | 네이버 지도 API 연동 (장소 검색) |
| `RedisModule` | Refresh Token 저장, 캐시 |
| `HealthModule` | 헬스체크 엔드포인트 (`GET /health`) |
| `NoticeModule` | 공지사항 CRUD (어드민 전용 CUD) |
| `FaqModule` | FAQ CRUD (어드민 전용 CUD) |
| `InquiryModule` | 1:1 문의 접수 및 관리 |

---

## 6. 인증 구조

```
[카카오 OAuth] → kakaoAccessToken → AuthService.kakaoLogin()
                                    → Redis에 refreshToken 저장 (rt:{userId}, TTL 7일)
                                    → accessToken (단기) + refreshToken (7일) 반환

[토큰 갱신] → POST /auth/refresh → Redis 토큰 비교 → 새 토큰 발급 (rotation)
[로그아웃]  → POST /auth/logout  → Redis에서 rt:{userId} 삭제
[어드민]    → POST /auth/admin/login → scrypt 해시 비교 (timing-safe)
```

---

## 7. 아키텍처 규칙 (코딩 컨벤션)

1. **Layered Architecture**: Controller → Service → Repository → Entity
2. **Controller는 thin** — 비즈니스 로직은 Service에만 위치
3. **DTO 3종 분리**: Create / Update / Response (Entity 직접 반환 금지)
4. **`return await` 필수**: 모든 async 함수에서 bare return Promise 금지
5. **Entity 명시적 등록**: `app.module.ts`에 와일드카드 glob 사용 금지
6. **ResponseDto 분리**: `XxxResponseDto.from(entity)` 패턴 사용
7. **QueryBuilder**: 파라미터 바인딩 필수 (SQL Injection 방지)

---

## 8. 환경변수 목록 (필수)

```
DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_DATABASE  # PostgreSQL
JWT_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN       # JWT
KAKAO_API_URL                                             # 카카오 API
ADMIN_EMAIL, ADMIN_PASSWORD_HASH                         # 어드민 계정 (scrypt 해시)
AWS_REGION, S3_BUCKET_NAME                               # AWS S3
REDIS_HOST, REDIS_PORT                                   # Redis
FIREBASE_SERVICE_ACCOUNT_JSON                            # FCM (선택, 없으면 알림 비활성화)
SENTRY_DSN                                               # Sentry (선택)
CORS_ORIGIN                                              # CORS 허용 도메인 (쉼표 구분)
PORT                                                     # 서버 포트 (기본 3000)
```

---

## 9. 공통 커맨드

```bash
npm run start:dev                    # 개발 서버 (hot-reload)
npm run build                        # 프로덕션 빌드
npm test                             # Jest 단위 테스트
npm run test:e2e                     # E2E 테스트
npm run test:cov                     # 커버리지 테스트
npm run lint                         # ESLint 검사 및 자동 수정

# 마이그레이션
npm run typeorm:migration:generate -- -n <이름>   # 마이그레이션 생성
npm run typeorm:migration:run                       # 마이그레이션 실행
npm run typeorm:migration:revert                    # 마이그레이션 롤백
```

---

## 10. 참조 문서

- `PROJECT.md` — 기술 스택, 아키텍처 개요, 데이터베이스 스키마, API 구조
- `PROGRESS.md` — 현재 개발 상태, 완료된 작업, 잔여 이슈
- `README.md` — 설치 및 실행 가이드
- `SECURITY_ARCHITECTURE.md` — 보안 아키텍처 상세
- `NICKNAME_SECURITY.md` — 닉네임 관련 보안 정책
- `.claude/reviews/code-review-checklist.md` — 코드 리뷰 체크리스트
- `.claude/skills/creating-nearprice-modules/` — 모듈 생성 패턴 (Entity/DTO/Service 템플릿)

---

## 완료 전 필수 검증 파이프라인

### ⛔ 완료 보고 금지 조건

아래 단계를 **전부 통과하기 전까지** 사용자에게 완료 보고를 할 수 없다.

**Step 1. 자동 검증**

```bash
npm run lint          # ESLint 검사
npx tsc --noEmit      # TypeScript 타입 검사
```

**Step 2. nestjs-reviewer Agent 코드 리뷰**

- 신규 생성하거나 수정한 모든 `.ts` 파일 대상
- CRITICAL/WARNING 이슈 없을 때까지 수정 후 재실행

**Step 3. 자체 검토 체크리스트**

- `return await` 있는가? (모든 async 함수)
- Entity 명시적 등록 (glob 패턴 금지)?
- ResponseDto 분리? (Entity 직접 반환 금지)
- decimal 컬럼에 transformer + parseFloat?
- findOne null 처리 → NotFoundException?
- class-validator 데코레이터 전부 적용?
- 보호된 엔드포인트에 `@UseGuards(JwtAuthGuard)` 적용?
- 민감 정보 로깅 없는가?
