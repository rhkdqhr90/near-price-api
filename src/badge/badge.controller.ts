import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import { BadgeEvaluatorService } from './services/badge-evaluator.service';
import { BadgeService } from './badge.service';
import { SetRepresentativeBadgeDto } from './dto/set-representative-badge.dto';
import { RepresentativeBadgeDto } from './dto/representative-badge.dto';
import { UserBadgesResponseDto } from './dto/user-badges-response.dto';
import { UserTrustScoreResponseDto } from './dto/user-trust-score-response.dto';

@Controller('users')
export class BadgeController {
  constructor(
    private readonly badgeEvaluator: BadgeEvaluatorService,
    private readonly badgeService: BadgeService,
  ) {}

  // 뱃지는 커뮤니티 공개 프로필 정보 — 비로그인 사용자도 조회 가능
  @Get(':userId/badges')
  async getUserBadges(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<UserBadgesResponseDto> {
    return await this.badgeEvaluator.getUserBadges(userId);
  }

  @Get(':userId/trust-score')
  @UseGuards(JwtAuthGuard)
  async getUserTrustScore(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUser: AuthUser,
  ): Promise<UserTrustScoreResponseDto> {
    if (currentUser.userId !== userId) {
      throw new ForbiddenException('본인의 신뢰도만 조회할 수 있습니다');
    }
    return await this.badgeService.getUserTrustScore(userId);
  }

  /**
   * 본인 대표 뱃지 설정/해제. 작성한 글의 닉네임 옆에 표시되는 뱃지를 사용자가 직접 고른다.
   *
   * 입력 규약은 `SetRepresentativeBadgeDto` 참조 — null / 정상 ID만 허용, 빈 문자열 거부.
   */
  @Patch('me/representative-badge')
  @UseGuards(JwtAuthGuard)
  // HTTP 레벨 abuse 방어 — 도메인 쿨다운(1시간) 메시지가 즉시 떨어지므로 한도는 여유롭게.
  @Throttle({ write: { limit: 60, ttl: 60_000 } })
  async setRepresentativeBadge(
    @Body() dto: SetRepresentativeBadgeDto,
    @CurrentUser() currentUser: AuthUser,
  ): Promise<RepresentativeBadgeDto | null> {
    return await this.badgeService.setRepresentativeBadge(
      currentUser.userId,
      dto.type,
    );
  }
}
