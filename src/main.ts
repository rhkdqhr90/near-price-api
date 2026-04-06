import * as Sentry from '@sentry/nestjs';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import helmet from 'helmet';
import compression from 'compression';
import * as express from 'express';
import type { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  // Sentry 초기화 (SENTRY_DSN 환경변수 설정 시 활성화)
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
  }

  // 프로덕션 환경에서 로그 레벨 제한
  const logLevel: ('error' | 'warn' | 'log' | 'debug' | 'verbose' | 'fatal')[] =
    process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['log', 'error', 'warn', 'debug'];

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: logLevel,
  });

  // 보안: Helmet 미들웨어 (HTTP 보안 헤더)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: {
        maxAge: 31536000, // 1년
        includeSubDomains: true,
        preload: true,
      },
      frameguard: { action: 'deny' },
      noSniff: true,
      xssFilter: true,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );

  // 성능: gzip 압축 (body 크기 최대 10MB)
  app.use(compression({ threshold: 1024 }));

  // 요청 크기 제한 (JSON 1MB, URL-encoded 1MB, 파일은 별도 처리)
  app.use(
    express.json({
      limit: process.env.NODE_ENV === 'production' ? '1mb' : '10mb',
    }),
  );
  app.use(
    express.urlencoded({
      limit: process.env.NODE_ENV === 'production' ? '1mb' : '10mb',
      extended: true,
    }),
  );

  // HTTPS 리다이렉트 미들웨어 (프로덕션 환경)
  // Host 헤더는 공격자가 조작 가능하므로 환경변수의 허용 도메인만 사용
  if (process.env.NODE_ENV === 'production') {
    const allowedHosts = new Set(
      (process.env.CORS_ORIGIN ?? '')
        .split(',')
        .map((o) => {
          try {
            return new URL(o.trim()).host;
          } catch {
            return '';
          }
        })
        .filter(Boolean),
    );
    // API 자체 호스트 추가 (CORS_ORIGIN에 없을 수 있으므로)
    if (process.env.API_HOST) {
      allowedHosts.add(process.env.API_HOST);
    }

    if (allowedHosts.size === 0) {
      new Logger('Bootstrap').error(
        '[Security] HTTPS redirect disabled — CORS_ORIGIN or API_HOST must be set in production to prevent open redirect',
      );
    } else {
      app.use((req: Request, res: Response, next: NextFunction) => {
        if (req.headers['x-forwarded-proto'] !== 'https') {
          const reqHost = req.headers.host ?? '';
          if (!allowedHosts.has(reqHost)) {
            res.status(421).end(); // Misdirected Request
            return;
          }
          res.redirect(`https://${reqHost}${req.url}`);
        } else {
          next();
        }
      });
    }
  }

  // CORS — 문자열 배열은 정확한 Origin 매칭 (suffix 우회 불가)
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : ['http://localhost:5173'];

  // 프로덕션에서 http:// Origin이 포함되면 경고 (https만 허용해야 함)
  if (process.env.NODE_ENV === 'production') {
    const insecure = corsOrigins.filter((o) => o.startsWith('http://'));
    if (insecure.length > 0) {
      new Logger('Bootstrap').warn(
        `[CORS] 프로덕션에서 http:// Origin이 허용되어 있습니다: ${insecure.join(', ')}`,
      );
    }
  }

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    maxAge: 86400,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO에 없는 필드 자동 제거
      forbidNonWhitelisted: true, // DTO에 없는 필드 있으면 에러
      transform: true, // 요청 데이터 타입 자동 변환
    }),
  );

  // 글로벌 예외 필터 등록
  app.useGlobalFilters(new GlobalExceptionFilter());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  if (process.env.NODE_ENV !== 'production') {
    new Logger('Bootstrap').log(`NearPrice API listening on port ${port}`);
  }
}
void bootstrap();
