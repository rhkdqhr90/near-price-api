import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import { PointService } from './point.service';
import { PointSummaryResponseDto } from './dto/point-summary-response.dto';
import { PointTransactionQueryDto } from './dto/point-transaction-query.dto';
import { PointTransactionListResponseDto } from './dto/point-transaction-response.dto';

@Controller('points')
@UseGuards(JwtAuthGuard)
export class PointController {
  constructor(private readonly pointService: PointService) {}

  @Get('me/summary')
  async getMySummary(
    @CurrentUser() user: AuthUser,
  ): Promise<PointSummaryResponseDto> {
    return await this.pointService.getSummary(user.userId);
  }

  @Get('me/transactions')
  async getMyTransactions(
    @CurrentUser() user: AuthUser,
    @Query() query: PointTransactionQueryDto,
  ): Promise<PointTransactionListResponseDto> {
    return await this.pointService.getTransactions(user.userId, query);
  }
}
