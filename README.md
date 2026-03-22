# NearPrice API

크라우드소싱 기반 동네 마트/시장 가격 비교 백엔드 API

**📚 중요 문서**:
- 🔒 [프로덕션 배포 가이드](./deploy/PRODUCTION_DEPLOY.md) - 보안, 성능, 모니터링 설정
- 🛠️ [개발 가이드](./CLAUDE.md) - 개발 환경 설정 및 아키텍처

## 프로젝트 개요

**핵심 가치**: "내가 살 거 제일 싼 데가 어디야"

**사용자 플로우**: 상품 검색 → 가격 순위 → 매장 위치 확인 → 가격 검증 및 신뢰도 평가

### 주요 기능
- 사용자 관리 (카카오 OAuth, 로컬 회원가입)
- 매장 정보 관리 (카카오 로컬 API 연동)
- 상품 정보 관리
- 가격 정보 등록 및 조회
- **가격 검증 시스템** (맞아요/달라요 투표)
- **신뢰도 점수** (trustScore) 자동 계산
- **배지 시스템** (신뢰도 기반 사용자 배지 부여)

---

## 기술 스택

| 항목 | 기술 |
|------|------|
| **프레임워크** | NestJS 9+ + TypeScript 5+ |
| **ORM** | TypeORM 0.3+ |
| **데이터베이스** | PostgreSQL 14+ |
| **인증** | JWT + 카카오 OAuth 2.0 |
| **검증** | class-validator + class-transformer |
| **테스트** | Jest + supertest |
| **패키지 매니저** | npm (pnpm/yarn 금지) |

---

## 환경 설정

### 필수 요구사항
- Node.js 18+
- PostgreSQL 14+ (Postgres.app 또는 docker)
- npm 9+

### 1단계: 환경 변수 설정

```bash
cp .env.example .env
```

`.env` 파일에 다음 항목 채우기:

```env
# 데이터베이스
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=nearprice
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# 카카오 OAuth
KAKAO_CLIENT_ID=your_kakao_client_id
KAKAO_CLIENT_SECRET=your_kakao_client_secret
KAKAO_REDIRECT_URL=http://localhost:3000/auth/kakao/callback

# 관리자 계정 (선택)
ADMIN_EMAIL=admin@nearprice.com
ADMIN_PASSWORD=initial_password
```

### 2단계: 의존성 설치 및 DB 마이그레이션

```bash
npm install

# TypeORM 마이그레이션 실행
npm run typeorm migration:run

# (선택) 시드 데이터 입력
npm run seed
```

---

## 실행 명령어

```bash
# 개발 서버 (hot-reload)
npm run start:dev

# 프로덕션 빌드
npm run build

# 프로덕션 실행
npm start

# 단위 테스트
npm run test

# 테스트 커버리지
npm run test:cov

# E2E 테스트
npm run test:e2e

# ESLint 실행
npm run lint

# ESLint 자동 수정
npm run lint:fix

# TypeScript 타입 검사
npx tsc --noEmit
```

---

## 아키텍처

### 레이어드 아키텍처

```
Request → Controller (thin) → Service (로직) → Repository → TypeORM Entity → PostgreSQL
```

- **Controller**: HTTP 요청/응답만 담당. 비즈니스 로직 금지.
- **Service**: 핵심 로직, 트랜잭션, 에러 처리
- **Repository**: Database 접근 (TypeORM Repository 사용)
- **Entity**: Database 테이블 매핑

### 모듈 구조

```
src/
├── auth/                      # 인증 (JWT, OAuth)
├── user/                      # 사용자 관리
├── store/                     # 매장 정보
├── product/                   # 상품 정보
├── price/                     # 가격 정보 (중심 엔티티)
├── price-reaction/            # 가격 반응 (신고/추천)
├── price-verification/        # 가격 검증 시스템 (NEW)
├── trust-score/               # 신뢰도 점수 계산 (NEW)
├── badge/                     # 사용자 배지 시스템 (NEW)
├── common/                    # 공유 요소
│   ├── decorators/
│   ├── filters/               # Exception filters
│   ├── guards/                # Auth guards
│   ├── interceptors/          # Response interceptors
│   └── pipes/                 # Validation pipes
├── config/                    # 환경 설정
└── main.ts                    # 애플리케이션 진입점
```

### 핵심 엔티티 관계

**Price가 앱의 중심 엔티티**:

```
User (사용자) ──┐
                ├─→ Price (가격 정보) ←─┬─ PriceVerification (검증)
Store (매장) ─→ ├─→ TrustScore (신뢰도)
                └─→ PriceReaction (반응/신고)
Product (상품)─→
```

- **Price**: User + Store + Product를 연결하는 핵심
- **PriceVerification**: 가격 데이터의 검증 및 신뢰도 데이터 수집
- **TrustScore**: 사용자가 등록한 모든 가격의 검증 비율 기반 점수 계산
- **Badge**: trustScore 등급별 사용자 배지 부여

---

## API 구조

### 인증

- `POST /auth/kakao` - 카카오 OAuth 로그인
- `POST /auth/admin-login` - 관리자 로컬 로그인
- `POST /auth/refresh` - 토큰 갱신

### 사용자

- `POST /users` - 회원가입
- `GET /users` - 사용자 목록 (관리자 전용)
- `GET /users/:id` - 사용자 상세 (자신 또는 공개 프로필)
- `PATCH /users/:id` - 사용자 정보 수정

### 매장/상품

- `GET /stores` - 매장 검색 (위치 기반)
- `POST /stores` - 매장 등록
- `GET /products` - 상품 검색
- `POST /products` - 상품 등록

### 가격

- `POST /prices` - 가격 등록
- `GET /prices` - 가격 목록 조회
- `GET /prices/:id` - 가격 상세 조회
- `PATCH /prices/:id` - 가격 수정 (본인만)
- `DELETE /prices/:id` - 가격 삭제 (본인 또는 관리자)

### 가격 검증 (NEW)

- `POST /prices/:id/verify` - 가격 검증 (맞아요/달라요)
- `GET /prices/:id/verifications` - 가격별 검증 데이터 조회

### 신뢰도 (NEW)

- `GET /users/:id/trust-score` - 사용자 신뢰도 점수 조회
- `GET /users/:id/badge` - 사용자 배지 정보 조회

---

## 코딩 규칙 (필수)

### 비동기 처리
```typescript
// ✅ 필수: return await 사용
async findOne(id: string): Promise<Entity> {
  const entity = await this.repository.findOne({ where: { id } });
  if (!entity) throw new NotFoundException();
  return await entity;
}

// ❌ 금지: bare return Promise
async findOne(id: string): Promise<Entity> {
  return this.repository.findOne({ where: { id } }); // 에러 처리 불가
}
```

### DTO 분리
```typescript
// 모든 모듈은 3가지 DTO 필수:
- CreateDto (입력 검증)
- UpdateDto (수정 검증)
- ResponseDto (응답 포맷)
```

### Entity 등록
```typescript
// ✅ 필수: 명시적 등록
TypeOrmModule.forFeature([User, Store, Product, Price])

// ❌ 금지: glob 패턴
TypeOrmModule.forFeature([...]) // auto-glob
```

### Decimal 컬럼 (좌표, 가격)
```typescript
@Column({
  type: 'decimal',
  precision: 10,
  scale: 2,
  transformer: {
    from: (v: string) => v !== null ? parseFloat(v) : null,
    to: (v: number) => v,
  },
})
latitude: number;
```

### 날짜 DTO
```typescript
import { Type } from 'class-transformer';

export class CreatePriceDto {
  @Type(() => Date)
  @IsDate()
  saleEndDate: Date;
}
```

### 에러 처리
```typescript
// findOne → null 시 NotFoundException 필수
if (!entity) {
  throw new NotFoundException(`${id} not found`);
}
```

---

## 검증 파이프라인

모든 작업 완료 전에 반드시 실행:

```bash
.claude/scripts/verify.sh
```

자동 수행 항목:
1. `npm run lint` (ESLint)
2. `npx tsc --noEmit` (TypeScript 타입 검사)
3. `return await` 누락 패턴 검사

---

## 배포

### 프로덕션 빌드

```bash
npm run build
npm start
```

### Docker 배포 (선택)

```bash
docker build -t nearprice-api .
docker run -p 3000:3000 nearprice-api
```

### 환경 변수 (프로덕션)
- `NODE_ENV=production` 설정
- 모든 민감 정보는 환경 변수로 관리
- `.env` 파일은 버전 관리 제외

---

## 문서

- [CLAUDE.md](./CLAUDE.md) - 프로젝트 컨벤션 및 검증 파이프라인
- [.claude/agents/](./\.claude/agents/) - Agent 역할 및 리뷰 규칙
- [.claude/skills/](./\.claude/skills/) - 모듈 생성 패턴 및 예제

---

## 지원 및 문의

- NestJS 공식 문서: https://docs.nestjs.com
- TypeORM 공식 문서: https://typeorm.io
- 프로젝트 이슈: GitHub Issues 참고
