import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BadgeEvaluatorService } from './services/badge-evaluator.service';

@Controller('users')
export class BadgeController {
  constructor(private readonly badgeService: BadgeEvaluatorService) {}

  @Get(':userId/badges')
  @UseGuards(JwtAuthGuard)
  async getUserBadges(@Param('userId', ParseUUIDPipe) userId: string) {
    return await this.badgeService.getUserBadges(userId);
  }
}
