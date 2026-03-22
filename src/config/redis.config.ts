import { ConfigService } from '@nestjs/config';

/**
 * Redis 캐싱 설정
 *
 * 프로덕션에서 사용할 Redis 설정을 제공합니다.
 * - Rate Limiting 상태 저장
 * - API 응답 캐싱 (가격, 인기 상품 등)
 * - 세션/토큰 블랙리스트 관리
 *
 * 사용 시: npm install @nestjs/cache-manager cache-manager-redis-store
 */

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  ttl?: number;
}

export const createRedisConfig = (
  configService: ConfigService,
): RedisConfig => {
  return {
    host: configService.get('REDIS_HOST', 'localhost'),
    port: configService.get('REDIS_PORT', 6379),
    password: configService.get('REDIS_PASSWORD'),
    db: configService.get('REDIS_DB', 0),
    ttl: 60 * 60 * 1000,
  };
};

export const REDIS_CONFIG_TOKEN = 'REDIS_CONFIG';
