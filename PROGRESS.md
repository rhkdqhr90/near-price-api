# PROGRESS.md — 마실앱 백엔드 개발 현황

> 현재 개발 상태, 완료된 작업, 잔여 이슈, 다음 작업 목록을 기록합니다.
> 작업 완료 시 이 파일을 업데이트하세요.

---

## 1. 현재 개발 상태

**단계**: 개발 완료 → **출시 전 테스트 단계**

- 모든 핵심 기능 구현 완료
- 보안 취약점 수정 완료 (아래 참조)
- 프로덕션 배포 환경(EC2 + PM2) 설정 완료
- Android 앱과 API 연동 중 (QA 진행 중)
- 해결해야 할 잔여 이슈 존재 (아래 참조)

---

## 2. 완료된 기능 목록

### 핵심 도메인
- **Auth**: Kakao OAuth 로그인, JWT 액세스/리프레시 토큰, 어드민 로그인
- **User**: 프로필 CRUD, 닉네임 변경(30일 제한), FCM 토큰 등록/수정
- **Store**: 매장 등록/검색/근처 조회(Haversine GPS), 매장 리뷰
- **Product**: 상품 등록/검색 (카테고리/단위 기반)
- **Price**: 가격 등록/조회/수정/삭제, 상품별 최저가 카드(DISTINCT ON)
- **PriceReaction**: 가격 좋아요/신고 (1인 1반응)
- **PriceVerification**: 맞아요/달라요 검증, 달라요 시 새 가격 자동 생성
- **TrustScore**: 사용자·가격 신뢰도 배치 계산 (매일 03:00)
- **Badge**: 뱃지 정의 관리, 검증 수 기반 자동 뱃지 부여
- **Wishlist**: 상품 찜하기/취소, 찜 사용자 FCM 알림
- **Upload**: AWS S3 이미지 업로드, Magic Bytes 검증
- **Notification**: FCM 단일/다중 발송, 만료 토큰 자동 정리
- **Flyer**: 소상공인 전단지 조회, OwnerPost 관리
- **Naver**: 네이버/카카오/Vworld 지도 API 연동 (지오코딩, 장소 검색)
- **Notice / FAQ / Inquiry**: 공지사항, FAQ, 1:1 문의

### 인프라 / 보안
- Helmet (보안 HTTP 헤더)
- CORS (프로덕션: HTTPS origin만 허용)
- gzip 압축 (1KB 이상 응답)
- ValidationPipe (whitelist + forbidNonWhitelisted)
- GlobalExceptionFilter (에러 포맷 통일)
- Sentry 에러 트래킹 연동

---

## 3. 완료된 보안 수정 사항

출시 전 보안 검토를 통해 아래 취약점들이 수정 완료되었습니다.

### ✅ Refresh Token 무효화 (Redis)

**문제**: 이전에는 리프레시 토큰을 DB/Redis에 저장하지 않아, 탈취된 토큰으로 무제한 재발급 가능
**수정**: Redis에 `rt:{userId}` 키로 저장 + 갱신 시 Rotation (이전 토큰 자동 무효화)

```typescript
// auth.service.ts
await this.redisService.set(
  `${REFRESH_TOKEN_PREFIX}${user.id}`,
  refreshToken,
  REFRESH_TOKEN_TTL_SECONDS, // 7일
);
```

### ✅ Rate Limiting (Throttler)

**문제**: API 엔드포인트에 요청 횟수 제한 없음
**수정**: `@nestjs/throttler` 적용, 엔드포인트 유형별 차등 제한

| 제한 유형 | 제한 | 대상 |
|-----------|------|------|
| default | 1분 100회 | 전역 기본값 |
| auth | 1분 5회 | 로그인/회원가입 |
| write | 1분 10회 | 가격/매장 등록 등 |
| search | 1분 30회 | 검색 엔드포인트 |
| read | 1분 60회 | 조회 엔드포인트 |

### ✅ 파일 업로드 Magic Bytes 검증

**문제**: 파일 MIME 타입을 Content-Type 헤더만으로 판단해 MIME 스푸핑 가능
**수정**: `file-type` 라이브러리로 실제 파일 시그니처(Magic Bytes) 검증

```typescript
// upload.controller.ts
const detected = await fromBuffer(file.buffer);
if (!detected || !(ALLOWED_MIMES as readonly string[]).includes(detected.mime)) {
  throw new BadRequestException('허용되지 않는 파일 형식입니다.');
}
```

### ✅ 어드민 로그인 Timing Attack 방지

**문제**: 이메일/비밀번호 비교에 `===` 사용 시 Timing Attack 취약
**수정**: `crypto.timingSafeEqual()` + `scrypt` 해시 비교로 변경

### ✅ HTTPS 리다이렉트 (프로덕션)

**수정**: 프로덕션 환경에서 HTTP 요청을 HTTPS로 자동 리다이렉트

---

## 4. 잔여 이슈 (출시 전 해결 필요)

### 🔴 HIGH: 전단지 FCM 대량 발송 OOM (Out Of Memory)

**위치**: `FlyerModule` (구체적 파일 확인 필요)
**증상**: 전단지 FCM 알림 발송 시 메모리 부족으로 서버 프로세스 종료
**원인 추정**: 대량 사용자 FCM 토큰을 한 번에 메모리에 로드 후 발송 시도
**현재 상태**: `NotificationService.sendToMany()`는 500개 청크 단위로 처리하도록 구현되어 있으나, 전단지 특화 발송 로직에서 별도 처리 미흡
**해결 방향**:
- 전단지 FCM 발송을 배치 처리로 전환 (cursor 기반 페이지네이션)
- 또는 BullMQ 같은 큐 시스템 도입 검토

### 🟡 MEDIUM: `stores` 테이블 위치 컬럼 인덱스 DB 미적용

**위치**: `store.entity.ts`
**증상**: Entity에 `@Index(['latitude', 'longitude'])` 정의되어 있으나 실제 DB에 인덱스 생성 여부 불확실
**원인**: `synchronize: false`로 인해 Entity 변경이 DB에 자동 반영되지 않음
**영향**: GPS 반경 조회(`GET /store/nearby`) 성능 저하 가능 — Bounding Box 사전 필터링이 풀 스캔으로 처리될 수 있음
**해결 방법**:
```bash
# 마이그레이션으로 인덱스 생성
npm run typeorm:migration:generate -- -n AddStoreLocationIndex
npm run typeorm:migration:run
```
또는 DB 직접 확인:
```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'stores';
```

### 🟡 MEDIUM: 신뢰도 점수 로직 충돌

**위치**: `TrustScoreScheduler` ↔ `PriceVerificationService`
**증상**: 실시간 검증 카운트 업데이트(`verificationCount`, `confirmedCount`, `disputedCount`)와 매일 03:00 배치 재계산 간 타이밍 충돌 가능성
**원인 상세**:
1. `PriceVerificationService`에서 검증 시 `verificationCount`를 atomic increment (`UPDATE ... SET count + 1`)
2. `TrustScoreScheduler`에서 매일 새벽 3시에 해당 값들을 기반으로 `trustScore` 재계산
3. 배치 실행 중 새 검증이 들어오면 해당 회차 점수가 불일치할 수 있음

**현재 영향도**: 낮음 (신뢰도 점수는 하루 단위 배치이므로 당일 오차 발생 후 다음 날 보정)
**해결 방향**: 배치 실행 중 잠금 또는 이벤트 기반 실시간 점수 계산 도입 검토

---

## 5. 다음 작업 (우선순위 순)

### P1 — 출시 전 필수

- [ ] `stores` 테이블 위치 컬럼 인덱스 DB 적용 여부 확인 및 마이그레이션 실행
- [ ] 전단지 FCM OOM 재현 및 배치 처리로 수정
- [ ] Android 앱 QA 테스트 완료
- [ ] 전체 E2E 테스트 실행 (`npm run test:e2e`)

### P2 — 출시 후 개선

- [ ] 신뢰도 점수 로직 충돌 해소 (이벤트 기반 실시간 계산 또는 분산 락)
- [ ] GPS 반경 조회 성능 튜닝 (실 사용자 데이터 기반 쿼리 플랜 분석)
- [ ] 네이버 OAuth 로그인 추가 (`user_oauths.provider: 'naver'` 이미 준비됨)
- [ ] 어드민 페이지 가격 승인/거절 워크플로우
- [ ] 가격 이력 조회 API (현재는 isActive=false로 비활성화만 가능)

### P3 — 장기 계획

- [ ] 검색 성능 개선 (현재 LIKE 검색 → Full-Text Search 또는 Elasticsearch 검토)
- [ ] 가격 통계 API (특정 상품의 가격 변동 추이)
- [ ] BullMQ 도입 (대량 FCM, 배치 처리 큐)

---

## 6. 변경 이력

| 날짜 | 작업 내용 |
|------|-----------|
| 2026-04-02 | CLAUDE.md / PROJECT.md / PROGRESS.md 초기 작성 (AI 컨텍스트 파일) |
| (이전) | Refresh Token 무효화 (Redis Rotation) 구현 |
| (이전) | Rate Limiting (Throttler) 전체 엔드포인트 적용 |
| (이전) | 파일 업로드 Magic Bytes 검증 적용 |
| (이전) | Helmet, CORS, gzip 압축, ValidationPipe 적용 |
| (이전) | 신뢰도 점수 시스템 (TrustScore) 구현 |
| (이전) | 뱃지 시스템 (Badge) 구현 |
| (이전) | 소상공인 전단지 (Flyer) 기능 구현 |
| (이전) | 네이버/카카오/Vworld 지도 API 연동 |
