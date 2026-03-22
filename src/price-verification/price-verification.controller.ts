import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import { PriceVerificationService } from './price-verification.service';
import { CreateVerificationDto } from './dto/create-verification.dto';
import {
  VerificationResponseDto,
  VerificationListResponseDto,
} from './dto/verification-response.dto';

@Controller('prices')
export class PriceVerificationController {
  constructor(private readonly verificationService: PriceVerificationService) {}

  /**
   * POST /prices/:priceId/verifications
   * 가격 검증 (맞아요/달라요)
   */
  @Post(':priceId/verifications')
  @UseGuards(JwtAuthGuard)
  async createVerification(
    @Param('priceId', ParseUUIDPipe) priceId: string,
    @CurrentUser() user: AuthUser,
    @Body() createVerificationDto: CreateVerificationDto,
  ): Promise<VerificationResponseDto> {
    return await this.verificationService.createVerification(
      priceId,
      user.userId,
      createVerificationDto,
    );
  }

  /**
   * GET /prices/:priceId/verifications
   * 특정 가격의 검증 목록 조회
   */
  @Get(':priceId/verifications')
  async getVerifications(
    @Param('priceId', ParseUUIDPipe) priceId: string,
    @Query('result') result?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<VerificationListResponseDto> {
    // page, limit 입력 검증 (SQL Injection 방지)
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '10', 10);

    if (isNaN(pageNum) || pageNum < 1) {
      throw new BadRequestException('Invalid page parameter');
    }
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      throw new BadRequestException('Invalid limit parameter (max 100)');
    }

    return await this.verificationService.getVerificationsByPrice(
      priceId,
      result as any,
      pageNum,
      limitNum,
    );
  }

  /**
   * GET /prices/:priceId/trust-score
   * 특정 가격의 신뢰도 점수 조회
   */
  @Get(':priceId/trust-score')
  async getPriceTrustScore(@Param('priceId', ParseUUIDPipe) priceId: string) {
    const { score, status } =
      await this.verificationService.calculatePriceTrustScore(priceId);
    return {
      priceId,
      trustScore: score,
      status,
      verificationCount: 0, // TODO: price repository에서 가져오기
      confirmedCount: 0,
      disputedCount: 0,
      isStale: false, // TODO: createdAt 기반으로 계산
      registeredAt: new Date(),
      daysSinceRegistered: 0,
    };
  }
}
