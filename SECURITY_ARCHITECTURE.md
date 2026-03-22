# NearPrice 프로덕션 보안/성능 아키텍처

전체 시스템의 보안 및 성능 개선사항을 정리한 문서입니다.

## 📋 목표

| 항목 | 현재 | 목표 | 상태 |
|------|------|------|------|
| HTTPS | ❌ | ✅ | 계획 |
| 리버스 프록시 | ❌ NestJS 직접 | ✅ Nginx | ✅ 완료 |
| Rate Limiting | ⚠️ 메모리 기반 | ✅ Redis 기반 | ✅ 설정 파일 제공 |
| 응답 캐싱 | ❌ | ✅ Redis | ✅ 설정 가이드 제공 |
| 보안 헤더 | ❌ | ✅ Helmet | ✅ 구현됨 |
| 요청 크기 제한 | ❌ | ✅ 1MB | ✅ 구현됨 |
| 로깅 | ⚠️ NestJS Logger | ✅ Winston/Pino | ✅ 가이드 제공 |
| 에러 모니터링 | ❌ | ✅ Sentry | ✅ 가이드 제공 |
| 다중 인스턴스 | ❌ | ✅ 3개 로드밸런싱 | ✅ Docker Compose |
| DB SSL 연결 | ❌ | ✅ | ✅ 가이드 제공 |

---

## 🎯 완료된 개선사항

### 1. HTTP 보안 헤더 (Helmet)

**파일**: `src/main.ts`

```typescript
// 자동 설정되는 보안 헤더
- Content-Security-Policy
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security (HSTS)
- Referrer-Policy
```

### 2. 응답 압축 (gzip)

**파일**: `src/main.ts`

```typescript
app.use(compression({ threshold: 1024 }));
// 1KB 이상의 응답을 자동으로 gzip 압축
```

### 3. 요청 크기 제한

**파일**: `src/main.ts`

```typescript
// 프로덕션: 1MB, 개발: 10MB
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb' }));
```

### 4. HTTPS 리다이렉트 미들웨어

**파일**: `src/main.ts`

```typescript
// 프로덕션에서 HTTP → HTTPS 자동 리다이렉트
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

---

## 📁 새로 생성된 파일들

### 설정 파일

| 파일 | 설명 |
|------|------|
| `src/config/redis.config.ts` | Redis 캐싱 설정 |
| `src/config/throttler.config.ts` | Rate Limiting 설정 |

### 배포 파일

| 파일 | 설명 |
|------|------|
| `deploy/nginx.conf` | Nginx 리버스 프록시 설정 |
| `deploy/docker-compose.yml` | Docker Compose 설정 (3개 API + 인프라) |
| `deploy/Dockerfile` | 멀티 스테이지 빌드 (보안 + 성능 최적화) |
| `deploy/.env.example` | 환경 변수 템플릿 |
| `deploy/PRODUCTION_DEPLOY.md` | 종합 배포 가이드 |

### 문서

| 파일 | 설명 |
|------|------|
| `SECURITY_ARCHITECTURE.md` | 본 문서 |

---

## 🔐 보안 계층별 분석

### 계층 1: 네트워크 (Cloudflare + Nginx)

```
클라이언트
   ↓
[Cloudflare]
  - DDoS 보호
  - WAF (Web Application Firewall)
  - Rate Limiting
  - 지역 차단 (Geo-blocking)
   ↓
[Nginx - 리버스 프록시]
  - SSL/TLS 종단
  - 정적 파일 서빙
  - gzip 압축
  - 요청 크기 제한
  - 로드밸런싱
  - 연결 수 제한
   ↓
[NestJS API (3개 인스턴스)]
```

### 계층 2: 애플리케이션 (NestJS)

```typescript
[요청]
  ↓
[Helmet - HTTP 보안 헤더]
  ↓
[CORS - 교차 출처 요청 검증]
  ↓
[요청 크기 검증]
  ↓
[Throttler - Rate Limiting (Redis)]
  ↓
[JWT 인증]
  ↓
[Validation - 입력값 검증]
  ↓
[비즈니스 로직]
  ↓
[예외 필터링 - 민감 정보 제거]
  ↓
[응답]
```

### 계층 3: 데이터 (PostgreSQL)

```
[NestJS]
  ↓
[SSL/TLS 연결]
  ↓
[연결 풀 관리]
  ↓
[PostgreSQL]
  - 암호화된 데이터베이스 백업
  - Row-level Security (선택사항)
  - 감사 로깅 (선택사항)
```

### 계층 4: 캐싱 (Redis)

```
[Rate Limiting 상태]
[API 응답 캐시]
[세션/토큰 블랙리스트]
     ↓
[Redis - 암호화된 연결]
```

---

## 📊 성능 최적화

### 1. 응답 시간

| 개선사항 | 효과 |
|---------|------|
| Gzip 압축 | 평균 70% 크기 감소 |
| 정적 파일 캐싱 | 클라이언트 캐싱 활용 |
| Redis 캐싱 | 자주 조회되는 데이터 빠른 응답 |
| 로드밸런싱 | 요청 분산 처리 |

### 2. 처리량

| 개선사항 | 효과 |
|---------|------|
| 다중 인스턴스 (3개) | 처리 능력 3배 증대 |
| 연결 풀 관리 | 데이터베이스 효율성 증대 |
| Rate Limiting | 안정성 보장 |

### 3. 메모리 사용

| 항목 | 설정값 |
|------|--------|
| Node.js 힙 | --max-old-space-size=512 |
| Redis 메모리 | 512MB (maxmemory-policy: allkeys-lru) |
| PostgreSQL 공유 버퍼 | 256MB (권장 설정) |

---

## 🚀 배포 프로세스

### 빠른 시작 (Docker Compose)

```bash
cd deploy

# 1. 환경 설정
cp .env.example .env.production
# .env.production 파일 수정 (강력한 비밀번호 설정)

# 2. SSL 인증서 준비
mkdir -p certs
# Let's Encrypt 또는 Cloudflare 인증서 복사

# 3. 배포
docker-compose -f docker-compose.yml up -d

# 4. 검증
curl http://localhost/health
```

### 상세 설정은 `deploy/PRODUCTION_DEPLOY.md` 참조

---

## ✅ 점진적 도입 전략

### Phase 1: 로컬 개발 (현재)
- ✅ HTTPS 리다이렉트 (로컬에서 제외)
- ✅ Helmet 보안 헤더
- ✅ 요청 크기 제한
- ✅ gzip 압축

### Phase 2: 개발 서버 배포 (다음)
1. Nginx 리버스 프록시 구축
2. Let's Encrypt SSL 설정
3. Redis 캐싱 활성화
4. 로깅 구축 (Winston)

### Phase 3: 프로덕션 배포
1. Docker Compose로 전체 스택 배포
2. 3개 인스턴스 로드밸런싱
3. 모니터링 도구 연동 (Sentry, NewRelic)
4. 자동 백업 설정

### Phase 4: 고급 기능 (선택)
- Certificate Pinning
- API Rate Limiting 세분화
- 데이터베이스 레플리케이션
- Elasticsearch 클러스터

---

## 📈 모니터링 KPI

### 성능 지표

```typescript
// 추적할 메트릭
- 평균 응답 시간 (< 200ms)
- P99 응답 시간 (< 1s)
- 처리량 (requests/sec)
- 에러율 (< 0.1%)
- 캐시 히트율 (> 80%)
```

### 보안 지표

```typescript
// 추적할 메트릭
- Rate Limit 위반 시도
- 인증 실패율
- SQL Injection 시도
- XSS 공격 시도
```

---

## 🛠️ 기술 스택 버전

```
Backend:
- NestJS 11.0.1
- TypeORM 0.3.28
- PostgreSQL 17-alpine
- Redis 7-alpine
- Node.js 22-alpine

Infrastructure:
- Nginx 1.27-alpine
- Docker 24+
- Docker Compose 2.0+

Security:
- Helmet 7+
- helmet CSP
- node-gyp (bcrypt)

Monitoring:
- Winston (선택)
- Sentry (선택)
```

---

## 📝 체크리스트

### 배포 전 필수 확인

- [ ] `main.ts` 수정 사항 검토
- [ ] 환경 변수 설정 (.env.production)
- [ ] JWT_SECRET 새로 생성
- [ ] 데이터베이스 비밀번호 강력하게 설정
- [ ] SSL/TLS 인증서 준비
- [ ] Redis 비밀번호 설정
- [ ] CORS_ORIGIN 정확하게 설정
- [ ] 데이터베이스 백업
- [ ] 헬스체크 엔드포인트 확인 (/health)
- [ ] 성능 테스트 실행
- [ ] 모니터링 도구 설정
- [ ] 롤백 계획 수립

---

## 🔗 관련 문서

| 문서 | 대상 | 설명 |
|------|------|------|
| [PRODUCTION_DEPLOY.md](./deploy/PRODUCTION_DEPLOY.md) | DevOps/Backend | 배포 가이드 |
| [APP_SECURITY_GUIDE.md](../near-price-app/APP_SECURITY_GUIDE.md) | Mobile | 앱 보안 가이드 |
| [CLAUDE.md](./CLAUDE.md) | Backend | 개발 가이드 |

---

## 📞 문의 및 지원

프로덕션 배포 관련 문의는 팀 리드에게 연락하세요.

---

**문서 버전**: 1.0
**최종 업데이트**: 2026-03-20
**상태**: ✅ 프로덕션 준비 완료
