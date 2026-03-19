import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(err: unknown, user: TUser): TUser | null {
    // 토큰 없음 / 유효하지 않음 / 만료 → 모두 비로그인 상태로 처리
    if (err || !user) return null;
    return user;
  }
}
