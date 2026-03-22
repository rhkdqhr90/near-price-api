# NearPrice API 프로덕션 배포 가이드

이 문서는 NearPrice API를 프로덕션 환경에 배포하기 위한 종합 가이드입니다.

## 목차

1. [아키텍처 개요](#아키텍처-개요)
2. [보안 설정](#보안-설정)
3. [성능 최적화](#성능-최적화)
4. [배포 절차](#배포-절차)
5. [모니터링 및 로깅](#모니터링-및-로깅)
6. [문제 해결](#문제-해결)

---

## 아키텍처 개요

### 전체 구조

```
Client
  ↓
Cloudflare (CDN + DDoS 보호)
  ↓
Nginx (리버스 프록시, SSL 종단, 로드밸런싱)
  ↓
NestJS API (3개 인스턴스)
  ├─ PostgreSQL (데이터베이스)
  ├─ Redis (캐싱, Rate Limiting, 세션)
  └─ Elasticsearch (전문 검색)
```

### 프로덕션 최적화 요소

| 항목 | 현재 상태 | 프로덕션 | 설명 |
|------|---------|---------|------|
| 리버스 프록시 | ❌ NestJS 직접 | ✅ Nginx | 정적 파일, gzip, 요청 크기 제한 |
| HTTPS | ❌ 없음 | ✅ SSL/TLS | Cloudflare + Nginx |
| Rate Limiting | ⚠️ 메모리 기반 | ✅ Redis 기반 | 다중 인스턴스 공유 |
| 캐싱 | ❌ 없음 | ✅ Redis | 자주 조회되는 데이터 캐싱 |
| 로깅 | ⚠️ NestJS Logger | ✅ Winston/Pino + 파일 | 구조화된 로그 |
| 모니터링 | ❌ 없음 | ✅ Sentry | 에러 추적 및 성능 모니터링 |
| 헬스체크 | ❌ 없음 | ✅ /health 엔드포인트 | 로드밸런서/자동 재시작 |

---

## 보안 설정

### 1. 환경 변수 설정

`.env.production` 파일을 생성하고 다음을 설정하세요:

```bash
# 필수 환경 변수
NODE_ENV=production

# 데이터베이스 (강력한 비밀번호 사용)
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=<strong-username>
DB_PASSWORD=<very-strong-password>
DB_DATABASE=near_price
DB_SSL=true  # SSL 연결 활성화

# Redis (캐싱 및 세션)
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=<very-strong-redis-password>
REDIS_DB=0

# JWT 토큰 (새로운 비밀키 생성)
JWT_SECRET=<generate-with: openssl rand -base64 32>
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=https://app.nearprice.com,https://admin.nearprice.com

# Kakao OAuth
KAKAO_REST_API_KEY=<production-kakao-key>
KAKAO_API_URL=https://kapi.kakao.com
BASE_URL=https://api.nearprice.com

# 관리자 (프로덕션: OAuth 권장, 임시 사용 금지)
ADMIN_EMAIL=admin@nearprice.com
ADMIN_PASSWORD_HASH=<재생성: node scripts/generate-admin-hash.mjs>

# Elasticsearch
ELASTICSEARCH_NODE=http://elasticsearch:9200

# 포트
PORT=3000
```

### 2. SSL/TLS 설정

#### 옵션 A: Let's Encrypt (권장)

```bash
# Certbot 설치
sudo apt install certbot python3-certbot-nginx

# 인증서 발급
sudo certbot certonly --standalone -d api.nearprice.com

# 자동 갱신 설정
sudo systemctl enable certbot.timer
```

Nginx 설정에 인증서 경로 지정:

```nginx
ssl_certificate /etc/letsencrypt/live/api.nearprice.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/api.nearprice.com/privkey.pem;
```

#### 옵션 B: Cloudflare (권장)

1. Cloudflare DNS로 도메인 설정
2. SSL/TLS 탭에서 "Full (strict)" 선택
3. Origin 인증서 발급 (API 서버용)
4. Nginx에 설정

```nginx
ssl_certificate /etc/nginx/certs/origin-cert.pem;
ssl_certificate_key /etc/nginx/certs/origin-key.key;
```

### 3. 데이터베이스 보안

#### SSL 연결

```typescript
// app.module.ts
TypeOrmModule.forRootAsync({
  useFactory: (configService: ConfigService) => ({
    type: 'postgres',
    host: configService.getOrThrow<string>('DB_HOST'),
    port: configService.getOrThrow<number>('DB_PORT'),
    username: configService.getOrThrow<string>('DB_USERNAME'),
    password: configService.getOrThrow<string>('DB_PASSWORD'),
    database: configService.getOrThrow<string>('DB_DATABASE'),

    // SSL 설정
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false, // 자체 서명 인증서의 경우
      ca: fs.readFileSync('/path/to/ca.crt').toString(),
    } : false,

    // 커넥션 풀 설정
    extra: {
      max: 20, // 최대 연결 수
      min: 5,  // 최소 연결 수
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    },

    logging: process.env.NODE_ENV !== 'production' ? true : false,
    synchronize: false, // 프로덕션에서는 수동 마이그레이션만 사용
  }),
})
```

#### 커넥션 풀 최적화

```typescript
// 슬로우 쿼리 로깅 (프로덕션)
logging: ['warn', 'error'],
logger: new TypeOrmLogger(),
maxQueryExecutionTime: 1000, // 1초 이상 쿼리는 로깅
```

### 4. HTTP 보안 헤더

Helmet 미들웨어가 다음 헤더를 자동 설정합니다:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; ...
Referrer-Policy: strict-origin-when-cross-origin
```

### 5. 요청 크기 제한

```typescript
// main.ts에 이미 설정됨
app.use(
  express.json({
    limit: process.env.NODE_ENV === 'production' ? '1mb' : '10mb',
  }),
);
```

### 6. Rate Limiting

Rate Limiting이 Redis로 관리됩니다:

```typescript
// 커스텀 Rate Limit 적용 예
import { Throttle } from '@nestjs/throttler';

@Throttle('auth', { limit: 3, ttl: 60000 })
@Post('auth/login')
async login() { ... }

@Throttle('write', { limit: 5, ttl: 60000 })
@Post('prices')
async createPrice() { ... }
```

---

## 성능 최적화

### 1. Redis 캐싱 설정

```typescript
// cache.module.ts 예시
import { CacheModule } from '@nestjs/cache-manager';
import * as redisStore from 'cache-manager-redis-store';

@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore.create({
          host: configService.get('REDIS_HOST'),
          port: configService.get('REDIS_PORT'),
          password: configService.get('REDIS_PASSWORD'),
          ttl: 60 * 60 * 1000, // 1시간
        }),
      }),
      inject: [ConfigService],
    }),
  ],
})
export class CacheModule {}
```

### 2. API 응답 캐싱

```typescript
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class ProductService {
  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getPopularProducts() {
    // 캐시 확인
    const cached = await this.cacheManager.get('popular-products');
    if (cached) {
      return cached;
    }

    // 데이터베이스 조회
    const products = await this.productRepository.find({
      order: { popularity: 'DESC' },
      take: 10,
    });

    // 캐시 저장 (1시간)
    await this.cacheManager.set('popular-products', products, 3600000);
    return products;
  }
}
```

### 3. Gzip 압축

```typescript
// main.ts에 이미 설정됨
app.use(compression({ threshold: 1024 }));
```

### 4. 정적 파일 캐싱

Nginx에서 자동으로 처리:

```nginx
location /uploads/ {
  expires 7d;
  add_header Cache-Control "public, immutable" always;
}
```

### 5. 데이터베이스 쿼리 최적화

```typescript
// N+1 문제 해결
this.repository.find({
  relations: ['user', 'store'],
  loadRelationIds: false,
});

// 필요한 컬럼만 선택
this.repository.find({
  select: ['id', 'name', 'price'],
});
```

---

## 배포 절차

### 방법 1: Docker Compose (권장)

#### 1단계: 환경 설정

```bash
cd near-price-api/deploy

# 환경 변수 파일 생성
cp .env.example .env.production
# .env.production 파일 수정 (강력한 비밀번호 설정)
```

#### 2단계: SSL 인증서 준비

```bash
# Let's Encrypt 인증서 복사 또는 Cloudflare 인증서 설정
mkdir -p certs
cp /etc/letsencrypt/live/api.nearprice.com/fullchain.pem certs/
cp /etc/letsencrypt/live/api.nearprice.com/privkey.pem certs/
chmod 600 certs/privkey.pem
```

#### 3단계: 배포

```bash
# 빌드 및 실행
docker-compose -f docker-compose.yml up -d

# 로그 확인
docker-compose logs -f api-1

# 헬스체크
curl http://localhost:3000/health

# 정상 작동 확인
curl -H "Host: api.nearprice.com" https://localhost/api/products
```

#### 4단계: 데이터베이스 마이그레이션

```bash
# 데이터베이스 초기화 (선택사항)
docker exec near-price-api-1 npm run typeorm migration:run

# 데이터베이스 상태 확인
docker exec near-price-postgres psql -U gwang-kyo -d near_price -c "\dt"
```

### 방법 2: PM2 (Node.js 프로세스 관리)

```bash
# 설치
npm install -g pm2

# 시작
pm2 start dist/main.js --name "near-price-api" \
  --env NODE_ENV=production \
  --instances 3 \
  --exec-mode cluster

# 로그 보기
pm2 logs near-price-api

# 모니터링
pm2 monit

# 자동 재시작 설정
pm2 startup
pm2 save
```

### 방법 3: 수동 배포

```bash
# 1. 빌드
npm run build

# 2. 의존성 설치 (프로덕션만)
npm ci --only=production

# 3. 마이그레이션 실행
npm run typeorm migration:run

# 4. 실행
NODE_ENV=production node dist/main
```

---

## 모니터링 및 로깅

### 1. Winston 로거 설정

```typescript
// logger.module.ts 예시
import { Module } from '@nestjs/common';
import { utilities as nestWinstonModuleUtilities, WinstonModule } from 'nest-winston';
import * as winston from 'winston';

@Module({
  providers: [
    {
      provide: 'WINSTON_LOGGER',
      useValue: WinstonModule.createLogger({
        transports: [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.timestamp(),
              nestWinstonModuleUtilities.format.nestLike('NearPrice', {
                colors: true,
                prettyPrint: true,
              }),
            ),
          }),
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: winston.format.json(),
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
            format: winston.format.json(),
            maxsize: 10485760, // 10MB
            maxFiles: 5,
          }),
        ],
      }),
    },
  ],
})
export class LoggerModule {}
```

### 2. Sentry 설정 (에러 모니터링)

```bash
npm install @sentry/node @sentry/tracing
```

```typescript
// main.ts
import * as Sentry from '@sentry/node';

if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });

  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.errorHandler());
}
```

### 3. 헬스체크 엔드포인트

```typescript
// health.controller.ts
@Controller('health')
export class HealthController {
  constructor(private health: HealthCheckService) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.health.database.pingCheck('database'),
      () => this.health.http.pingCheck('elasticsearch', 'http://localhost:9200'),
    ]);
  }
}
```

### 4. 로그 파일 관리

```bash
# 로그 디렉토리 생성
mkdir -p logs

# 로그 로테이션 설정 (logrotate)
sudo vi /etc/logrotate.d/near-price-api
```

```
/var/www/near-price-api/logs/*.log {
  daily
  rotate 30
  compress
  delaycompress
  notifempty
  create 0640 nodejs nodejs
  sharedscripts
  postrotate
    systemctl reload near-price-api > /dev/null 2>&1 || true
  endscript
}
```

---

## 문제 해결

### 1. 높은 메모리 사용량

```bash
# 메모리 사용량 확인
docker stats near-price-api-1

# Node.js 힙 크기 제한
NODE_OPTIONS="--max-old-space-size=512" node dist/main
```

### 2. Rate Limiting 문제

```bash
# Redis 연결 확인
redis-cli -h redis -p 6379 -a <password> ping

# Rate Limit 상태 확인
redis-cli -h redis -a <password> KEYS "throttler*" | wc -l
```

### 3. 데이터베이스 연결 풀 고갈

```sql
-- 연결 상태 확인
SELECT count(*) as total_connections FROM pg_stat_activity;

-- 쿼리 진행 상황 확인
SELECT pid, query, query_start FROM pg_stat_activity WHERE state = 'active';

-- 오래된 연결 종료
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE state = 'idle' AND query_start < now() - interval '30 minutes';
```

### 4. Elasticsearch 색인 문제

```bash
# Elasticsearch 헬스 확인
curl http://localhost:9200/_cluster/health

# 색인 상태 확인
curl http://localhost:9200/_cat/indices

# 색인 재구축
curl -X POST http://localhost:9200/products/_reindex
```

### 5. Nginx 설정 검증

```bash
# Nginx 설정 문법 확인
nginx -t

# 설정 다시 로드 (무중단)
nginx -s reload
```

---

## 체크리스트

배포 전 확인사항:

- [ ] 환경 변수 설정 (.env.production)
- [ ] JWT_SECRET 새로 생성 (`openssl rand -base64 32`)
- [ ] 데이터베이스 비밀번호 강력하게 설정
- [ ] Redis 비밀번호 설정
- [ ] SSL/TLS 인증서 준비
- [ ] CORS_ORIGIN 정확하게 설정
- [ ] 관리자 비밀번호 해시 재생성
- [ ] 데이터베이스 백업
- [ ] 로그 디렉토리 생성
- [ ] 헬스체크 엔드포인트 확인
- [ ] 성능 테스트 (부하 테스트)
- [ ] 모니터링 도구 설정 (Sentry, NewRelic 등)
- [ ] 백업 및 복구 절차 검증
- [ ] 롤백 계획 수립

---

## 참고 자료

- [NestJS 프로덕션 배포](https://docs.nestjs.com/deployment)
- [Nginx 리버스 프록시](https://nginx.org/en/docs/)
- [Docker 보안 모범 사례](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- [OWASP API 보안](https://cheatsheetseries.owasp.org/cheatsheets/API_Security_Cheat_Sheet.html)
- [PostgreSQL 성능 튜닝](https://wiki.postgresql.org/wiki/Performance_Optimization)

---

**마지막 업데이트**: 2026-03-20
**상태**: 프로덕션 준비 완료
