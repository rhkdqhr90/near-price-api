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
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import { BadgeEvaluatorService } from './services/badge-evaluator.service';
import { BadgeService } from './badge.service';

class SetRepresentativeBadgeDto {
  /** masil_1 ~ masil_23. null/빈 문자열이면 해제. */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  type?: string | null;
}

@Controller('users')
export class BadgeController {
  constructor(
    private readonly badgeEvaluatorService: BadgeEvaluatorService,
    private readonly badgeService: BadgeService,
  ) {}

  // 뱃지는 커뮤니티 공개 프로필 정보 — 비로그인 사용자도 조회 가능
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

  /**
   * 본인 대표 뱃지 설정/해제. 작성한 글의 닉네임 옆에 표시되는 뱃지를 사용자가 직접 고른다.
   * body: `{ type: 'masil_X' | null }`. 보유하지 않은 뱃지면 400.
   */
  @Patch('me/representative-badge')
  @UseGuards(JwtAuthGuard)
  async setRepresentativeBadge(
    @Body() dto: SetRepresentativeBadgeDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const next = dto.type && dto.type.length > 0 ? dto.type : null;
    return await this.badgeService.setRepresentativeBadge(
      currentUser.userId,
      next,
    );
  }
}
