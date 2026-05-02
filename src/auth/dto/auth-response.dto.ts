import { RepresentativeBadgeDto } from '../../badge/dto/representative-badge.dto';

/**
 * 카카오/어드민 로그인 + refresh 응답에 포함되는 user 슬라이스.
 * 앱은 로그인/refresh 직후 이 user 객체를 zustand authStore에 그대로 저장하므로
 * representativeBadge를 함께 내려야 닉네임 옆 InlineBadge가 즉시 렌더된다.
 */
export class AuthUserDto {
  id: string;
  email: string;
  nickname: string;
  trustScore: number;
  profileImageUrl: string | null;
  representativeBadge: RepresentativeBadgeDto | null;
}

export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDto;
}
