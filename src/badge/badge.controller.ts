import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import { BadgeEvaluatorService } from './services/badge-evaluator.service';
import { BadgeService } from './badge.service';

@Controller('users')
export class BadgeController {
  constructor(
    private readonly badgeEvaluatorService: BadgeEvaluatorService,
    private readonly badgeService: BadgeService,
  ) {}

  // 배지는 커뮤니티 공개 프로필 정보 — 비로그인 사용자도 조회 가능
  @Get(':userId/badges')
  async getUserBadges(@Param('userId', ParseUUIDPipe) userId: string) {
    return await this.badgeEvaluatorService.getUserBadges(userId);
  }

  @Get(':userId/trust-score')
  @UseGuards(JwtAuthGuard)
  async getUserTrustScore(
    @Param('userId', ParseUUIDPipe) userId: string,
    @CurrentUser() currentUser: AuthUser,
  ) {
    if (currentUser.userId !== userId) {
      throw new ForbiddenException('본인의 신뢰도만 조회할 수 있습니다');
    }
    return await this.badgeService.getUserTrustScore(userId);
  }
}
