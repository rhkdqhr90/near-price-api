import { ConfigService } from '@nestjs/config';
import { ThrottlerModuleOptions } from '@nestjs/throttler';
import { minutes } from '@nestjs/throttler';

/**
 * Rate Limiting 설정
 *
 * 프로덕션에서는 Redis 저장소를 사용하여 여러 서버 인스턴스 간에
 * Rate Limiting 상태를 공유합니다.
 *
 * 참고: https://docs.nestjs.com/security/rate-limiting
 */

export const createThrottlerConfig = (
  _configService: ConfigService,
): ThrottlerModuleOptions => {
  return [
    // 기본 Rate Limit: 1분에 100요청
    {
      name: 'default',
      ttl: minutes(1),
      limit: 100,
    },
    // 인증 관련: 1분에 5요청 (로그인, 회원가입 등)
    {
      name: 'auth',
      ttl: minutes(1),
      limit: 5,
    },
    // API 읽기: 1분에 60요청
    {
      name: 'read',
      ttl: minutes(1),
      limit: 60,
    },
    // API 쓰기 (가격 등록 등): 1분에 10요청
    {
      name: 'write',
      ttl: minutes(1),
      limit: 10,
    },
    // 검색: 1분에 30요청
    {
      name: 'search',
      ttl: minutes(1),
      limit: 30,
    },
  ];
};

/**
 * 엔드포인트별 Rate Limiting 데코레이터 사용 예시:
 *
 * import { Throttle } from '@nestjs/throttler';
 *
 * @Throttle('auth', { limit: 3, ttl: minutes(1) })
 * @Post('auth/login')
 * async login() { ... }
 *
 * @Throttle('write', { limit: 5, ttl: minutes(1) })
 * @Post('prices')
 * async createPrice() { ... }
 */
