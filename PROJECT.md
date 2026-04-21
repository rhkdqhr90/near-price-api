# PROJECT.md — 마실앱 백엔드 프로젝트 기술 문서

> 기술 스택, 아키텍처 개요, 데이터베이스 스키마, API 구조를 담은 참조 문서입니다.

---

## 1. 기술 스택 및 선택 이유

### 핵심 프레임워크

| 기술 | 버전 | 선택 이유 |
|------|------|-----------|
| NestJS | ^11.0.1 | TypeScript 네이티브, 모듈 기반 구조, DI 컨테이너, Decorator 패턴 |
| TypeScript | ^5.7.3 | 타입 안전성, 런타임 에러 사전 방지 |
| TypeORM | ^0.3.28 | NestJS 공식 ORM, 마이그레이션 지원, 데코레이터 기반 Entity 정의 |
| PostgreSQL | 14 | 트랜잭션 지원, `DISTINCT ON` 쿼리, 좌표 기반 공간 쿼리에 적합 |

### 주요 라이브러리

| 라이브러리 | 역할 |
|------------|------|
| `@nestjs/jwt` + `passport-jwt` | JWT 액세스/리프레시 토큰 인증 |
| `@nestjs/throttler` | Rate Limiting (엔드포인트별 차등 적용) |
| `redis` | Refresh Token 저장 및 무효화 |
| `firebase-admin` | FCM 푸시 알림 (찜 알림, 검증 알림, 뱃지 알림) |
| `@aws-sdk/client-s3` | 이미지 파일 S3 업로드 |
| `file-type` | Magic Bytes 검증 (MIME 스푸핑 방지) |
| `@nestjs/schedule` | 신뢰도 점수 일일 배치 (`0 3 * * *`) |
| `helmet` | HTTP 보안 헤더 (CSP, HSTS, X-Frame-Options 등) |
| `compression` | gzip 응답 압축 (1KB 이상 대상) |
| `axios` | Kakao OAuth API, 네이버/카카오/Vworld 외부 API 호출 |
| `@sentry/nestjs` | 프로덕션 에러 트래킹 |
| `class-validator` + `class-transformer` | DTO 유효성 검사 및 타입 변환 |

---

## 2. 아키텍처 개요

```
클라이언트 (Android)
     │
     ▼
[NestJS API 서버]
     ├── main.ts            (Helmet, CORS, Compression, ValidationPipe, ExceptionFilter)
     ├── app.module.ts      (전체 모듈 조립, Throttler 전역 적용)
     │
     ├── auth/             (JWT 발급, Kakao OAuth, 어드민 로그인)
     ├── user/             (프로필, 닉네임, FCM 토큰)
     ├── store/            (매장 등록/검색, GPS 거리 계산, 리뷰)
     ├── product/          (상품 등록/검색)
     ├── price/            (가격 등록, 최저가 카드, 찜 알림)
     ├── price-reaction/   (좋아요/신고)
     ├── price-verification/ (맞아요/달라요, 새 가격 자동 생성)
     ├── trust-score/      (신뢰도 배치 계산, Scheduler)
     ├── badge/            (뱃지 정의 및 부여)
     ├── wishlist/         (찜 목록)
     ├── upload/           (S3 이미지 업로드)
     ├── notification/     (FCM 발송)
     ├── flyer/            (소상공인 전단지)
     ├── naver/            (네이버/카카오/Vworld API)
     ├── redis/            (Refresh Token 저장)
     ├── notice/, faq/, inquiry/ (공지/FAQ/문의)
     └── health/           (헬스체크)
     │
     ├── [PostgreSQL 14]   (메인 데이터베이스)
     ├── [Redis]           (Refresh Token 저장, 캐시)
     └── [AWS S3]          (이미지 파일 스토리지)
```

### 레이어 구조

```
Controller  →  Service  →  Repository (TypeORM)  →  PostgreSQL
    │              │
    │         NotificationService (FCM)
    │         UploadService (S3)
    │         RedisService (Redis)
    │
[JwtAuthGuard / AdminGuard / ThrottlerGuard]
[ValidationPipe] [GlobalExceptionFilter]
```

---

## 3. 데이터베이스 스키마 요약

### 핵심 테이블

#### `users`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| email | varchar UNIQUE | |
| nickname | varchar UNIQUE | 30일 변경 제한 |
| latitude / longitude | decimal(10,7) | 사용자 GPS 위치 (nullable) |
| role | enum(user, admin) | 기본값 user |
| profileImageUrl | varchar | nullable |
| fcmToken | varchar | FCM 토큰 (nullable, 만료 시 NULL 처리) |
| notifPriceChange | boolean | 찜 상품 가격 변동 알림 여부 (기본 true) |
| notifPromotion | boolean | 프로모션 알림 여부 (기본 false) |
| trustScore | int | 신뢰도 점수 (기본 0, TrustScoreModule에서 관리) |
| nicknameChangedAt | timestamp | 닉네임 마지막 변경 시각 |

#### `user_oauths`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| user_id | UUID FK → users | |
| provider | enum(kakao, naver) | |
| providerId | varchar | 카카오/네이버 고유 ID |

#### `stores`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| name | varchar | 매장명 |
| type | varchar | 매장 타입 (enum 아님 - 커스텀 지원) |
| latitude / longitude | decimal(10,7) | GPS 좌표 — 복합 인덱스 (`latitude`, `longitude`) |
| address | varchar | 주소 |
| externalPlaceId | varchar UNIQUE nullable | 네이버/카카오 API 장소 ID (커스텀 매장은 NULL) |

#### `products`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| name | varchar | 상품명 |
| category | enum | vegetable/fruit/meat/seafood/dairy/grain/processed/household/other |
| unitType | enum | g/kg/ml/l/count/bunch/pack/bag/other |

#### `prices` (핵심 엔티티)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID PK | |
| user_id | UUID FK → users (SET NULL) | 탈퇴 시 NULL 처리 |
| store_id | UUID FK → stores (CASCADE) | |
| product_id | UUID FK → products (CASCADE) | |
| price | int | 가격 (원) |
| quantity | decimal(10,3) nullable | 수량 |
| imageUrl | varchar NOT NULL | **사진 필수** |
| saleStartDate / saleEndDate | date nullable | 세일 기간 |
| condition | varchar nullable | 상품 상태 (예: "마감할인") |
| isActive | boolean | 활성 여부 (기본 true) |
| likeCount | int | 좋아요 수 |
| reportCount | int | 신고 수 |
| trustScore | decimal(5,2) nullable | 가격 신뢰도 점수 |
| verificationCount / confirmedCount / disputedCount | int | 검증 통계 |

> 복합 인덱스: `(product_id, isActive, price)` — 상품별 최저가 조회 최적화

#### `price_reactions`
- 1가격 1유저 1반응 (UNIQUE 제약)
- type: enum(confirm, report)

#### `price_verifications`
- 24시간 내 중복 검증 방지 (비즈니스 로직)
- result: enum(confirmed, disputed)
- `disputed` 시 새 가격 자동 생성 → `new_price_id` FK 연결

#### `user_trust_scores`
- users와 1:1 관계
- trustScore / registrationScore / verificationScore / consistencyBonus
- 매일 03:00 배치 재계산

#### `badge_definitions`
| 필드 | 설명 |
|------|------|
| category | REGISTRATION / VERIFICATION / TRUST |
| threshold | 뱃지 획득 조건 수치 |
| durationDays | 유효 기간 (nullable = 영구) |

#### `user_badges`
- user + badgeDefinition 조합 UNIQUE
- earnedAt 기록

#### `flyers`
- 소상공인 전단지 데이터
- products / reviews 컬럼: `simple-json` 타입 (JSON 직렬화)

#### `store_reviews`
- store + user 조합 UNIQUE (1인 1리뷰)
- rating: int, comment: varchar nullable

---

## 4. API 구조 요약

### 인증 (`/auth`)
| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| POST | `/auth/kakao/login` | - | 카카오 OAuth 로그인 |
| POST | `/auth/refresh` | - | 토큰 갱신 |
| POST | `/auth/logout` | JWT | 로그아웃 (Redis 토큰 삭제) |
| POST | `/auth/admin/login` | - | 어드민 로그인 |

### 매장 (`/store`)
| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| POST | `/store` | JWT | 매장 등록 **(일반 유저 가능 - 의도된 설계)** |
| GET | `/store` | - | 매장 목록 (페이지네이션) |
| GET | `/store/search?name=` | - | 매장명 검색 |
| GET | `/store/nearby` | - | GPS 반경 내 매장 조회 (Haversine) |
| GET | `/store/by-external/:id` | - | 외부 API 장소 ID로 조회 |
| GET | `/store/:id` | - | 매장 상세 |
| PATCH | `/store/:id` | JWT + Admin | 매장 수정 |
| DELETE | `/store/:id` | JWT + Admin | 매장 삭제 |
| POST | `/store/:id/reviews` | JWT | 매장 리뷰 등록 |
| GET | `/store/:id/reviews` | - | 매장 리뷰 목록 |

### 상품 (`/product`)
| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| POST | `/product` | JWT | 상품 등록 |
| GET | `/product` | - | 상품 목록 |
| GET | `/product/search?name=` | - | 상품명 검색 |
| GET | `/product/:id` | - | 상품 상세 |

### 가격 (`/price`)
| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| POST | `/price` | JWT | 가격 등록 (이미지 URL 필수) |
| GET | `/price` | - | 전체 활성 가격 목록 |
| GET | `/price/recent` | - | 최신 가격 목록 |
| GET | `/price/recent-by-product` | - | 상품별 최저가 카드 (DISTINCT ON) |
| GET | `/price/by-product/:id` | - | 특정 상품 가격 목록 |
| GET | `/price/by-store/:id` | - | 특정 매장 가격 목록 |
| GET | `/price/by-user/:id` | JWT | 특정 유저 등록 가격 |
| GET | `/price/:id` | - | 가격 상세 |
| PATCH | `/price/:id` | JWT | 가격 수정 (본인만) |
| DELETE | `/price/:id` | JWT | 가격 삭제 (본인만) |

### 파일 업로드 (`/upload`)
| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| POST | `/upload` | JWT | 이미지 S3 업로드 (Magic Bytes 검증) |

### 기타 주요 엔드포인트
- `POST /price-reactions/:priceId` — 가격 반응 (좋아요/신고)
- `POST /price-verifications/:priceId` — 가격 검증 (맞아요/달라요)
- `GET /badge/trust-score` — 내 신뢰도 점수 조회
- `GET /flyer` — 전단지 목록
- `GET /health` — 헬스체크
- `GET /naver/geocode` — 주소→좌표 변환

---

## 5. 환경 설정 방법

### 개발 환경 설치

```bash
# 의존성 설치
npm install

# .env 파일 생성 (아래 변수 필수)
cp .env.example .env

# PostgreSQL DB 생성
createdb nearprice

# 마이그레이션 실행
npm run typeorm:migration:run

# 개발 서버 실행
npm run start:dev
```

### 필수 환경변수 (`.env`)

```env
# 데이터베이스
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=nearprice

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# 카카오 OAuth
KAKAO_API_URL=https://kapi.kakao.com

# 어드민 계정 (scrypt 해시: "<salt>:<hex-hash>" 형식)
ADMIN_EMAIL=admin@nearprice.app
ADMIN_PASSWORD_HASH=<salt>:<hex-hash>

# AWS S3
AWS_REGION=ap-northeast-2
S3_BUCKET_NAME=your-s3-bucket

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# 선택 (없으면 비활성화)
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
SENTRY_DSN=https://...

# CORS
CORS_ORIGIN=http://localhost:5173
```

### 프로덕션 배포 (EC2 + SSM + Docker Compose)

```bash
git archive --format=tar.gz -o /tmp/near-price-api.tar.gz HEAD
aws s3 cp /tmp/near-price-api.tar.gz s3://<DEPLOY_BUCKET>/deploy/near-price-api.tar.gz

# SSM send-command로 EC2에서 아래 순서 실행
# 1) /home/ec2-user/near-price-api 압축 해제
# 2) docker compose -f deploy/docker-compose.yml --env-file .env up -d --build api nginx
# 3) docker exec near-price-api npm run typeorm:migration:run:prod
```

프로덕션 환경에서는 EC2의 `/home/ec2-user/near-price-api/.env`를 기준으로 컨테이너를 구동합니다.

---

## 6. 신뢰도 시스템 구조

```
[가격 등록]
    ↓
[PriceVerification: 맞아요/달라요]
    ↓
[매일 03:00 TrustScoreScheduler]
    ├── PriceTrustScoreCalculator (검증 10건 이상인 가격 대상)
    │   └── confirmed/disputed 비율 + 검증자 신뢰도 가중치 → price.trustScore
    │
    └── UserTrustScoreCalculator (전체 유저 대상)
        ├── registrationScore: 최근 90일 등록 가격의 평균 신뢰도
        ├── verificationScore: 최근 30일 검증 중 다수 의견 일치 비율
        └── consistencyBonus: 연속 활동 일수 보너스
            → user_trust_scores 테이블 갱신
            → users.trustScore 갱신
```
