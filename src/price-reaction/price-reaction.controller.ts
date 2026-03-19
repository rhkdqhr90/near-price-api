import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentUserOptional } from '../common/decorators/current-user-optional.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import { AdminReportDto } from './dto/admin-report.dto';
import { CreateReportDto } from './dto/create-report.dto';
import { ReactionResponseDto } from './dto/reaction-response.dto';
import { PriceReactionService } from './price-reaction.service';

@Controller('price')
export class PriceReactionController {
  constructor(private readonly priceReactionService: PriceReactionService) {}

  @Get('admin/reports')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findAllReports(): Promise<AdminReportDto[]> {
    return await this.priceReactionService.findAllReports();
  }

  @Post(':id/confirm')
  @UseGuards(JwtAuthGuard)
  async confirm(
    @Param('id') priceId: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.priceReactionService.confirm(priceId, user.userId);
  }

  @Post(':id/report')
  @UseGuards(JwtAuthGuard)
  async report(
    @Param('id') priceId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReportDto,
  ): Promise<void> {
    await this.priceReactionService.report(priceId, user.userId, dto.reason);
  }

  @Get(':id/reactions')
  @UseGuards(OptionalJwtAuthGuard)
  async getReactions(
    @Param('id') priceId: string,
    @CurrentUserOptional() user: AuthUser | null,
  ): Promise<ReactionResponseDto> {
    return await this.priceReactionService.getReactions(
      priceId,
      user?.userId ?? null,
    );
  }
}
