import * as Sentry from '@sentry/nestjs';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
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
          styleSrc: ["'self'", "'unsafe-inline'"],
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
  if (process.env.NODE_ENV === 'production') {
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.headers['x-forwarded-proto'] !== 'https') {
        res.redirect(`https://${req.headers.host ?? ''}${req.url}`);
      } else {
        next();
      }
    });
  }

  // 전역 유효성 검사
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'],
    credentials: true,
    maxAge: 86400, // 24시간
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

  // 업로드 이미지 정적 파일 서빙 (캐시 설정)
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads',
    maxAge: process.env.NODE_ENV === 'production' ? '7d' : '1h',
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  if (process.env.NODE_ENV !== 'production') {
    console.log(`NearPrice API listening on http://localhost:${port}`);
  }
}
void bootstrap();
