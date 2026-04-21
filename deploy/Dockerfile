# 멀티 스테이지 빌드 - 프로덕션 최적화 (보안 + 성능)

# 1단계: 빌드
FROM node:22-alpine AS builder

WORKDIR /app

# t3.micro 메모리 환경에서 Nest build OOM 방지
ENV NODE_OPTIONS=--max-old-space-size=1024

# 빌드 의존성 설치
RUN apk add --no-cache python3 make g++

# 패키지 파일 복사 (레이어 캐싱)
COPY package*.json ./
COPY tsconfig*.json ./

# 의존성 설치
RUN npm ci --legacy-peer-deps

# 소스 코드 복사
COPY src ./src
COPY nest-cli.json .

# 빌드
RUN npm run build

# 2단계: 런타임
FROM node:22-alpine

WORKDIR /app

# 보안: 일반 사용자로 실행 (root 권한 없음)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 패키지 파일 복사
COPY package*.json ./

# 프로덕션 의존성만 설치
RUN npm ci --only=production --legacy-peer-deps && \
    npm cache clean --force

# 빌드 결과물 복사
COPY --from=builder /app/dist ./dist

# 업로드 디렉토리 생성 (권한 설정)
RUN mkdir -p uploads && \
    chown -R nodejs:nodejs /app

# nodejs 사용자로 전환
USER nodejs

# 헬스체크 설정
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { if (res.statusCode !== 200) throw new Error(res.statusCode) })"

# 포트 노출
EXPOSE 3000

# 애플리케이션 실행
CMD ["node", "dist/main"]
