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
import { VerificationResult } from './entities/price-verification.entity';

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
   * GET /prices/my/verifications
   * 내가 검증한 가격 목록 조회
   */
  @Get('my/verifications')
  @UseGuards(JwtAuthGuard)
  async getMyVerifications(
    @CurrentUser() user: AuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '20', 10);

    if (isNaN(pageNum) || pageNum < 1) {
      throw new BadRequestException('Invalid page parameter');
    }
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      throw new BadRequestException('Invalid limit parameter (max 100)');
    }

    return await this.verificationService.getVerificationsByVerifier(
      user.userId,
      pageNum,
      limitNum,
    );
  }

  /**
   * GET /prices/:priceId/verifications
   * 특정 가격의 검증 목록 조회 (공개 엔드포인트: 인증 불필요)
   */
  @Get(':priceId/verifications')
  async getVerifications(
    @Param('priceId', ParseUUIDPipe) priceId: string,
    @Query('result') result?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<VerificationListResponseDto> {
    // result enum 검증
    if (
      result !== undefined &&
      !Object.values(VerificationResult).includes(result as VerificationResult)
    ) {
      throw new BadRequestException('Invalid result parameter');
    }

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
      result as VerificationResult | undefined,
      pageNum,
      limitNum,
    );
  }

  /**
   * GET /prices/:priceId/trust-score
   * 특정 가격의 신뢰도 점수 조회 (공개 엔드포인트: 인증 불필요)
   */
  @Get(':priceId/trust-score')
  async getPriceTrustScore(@Param('priceId', ParseUUIDPipe) priceId: string) {
    const result =
      await this.verificationService.calculatePriceTrustScore(priceId);
    return {
      priceId,
      trustScore: result.score,
      status: result.status,
      verificationCount: result.verificationCount,
      confirmedCount: result.confirmedCount,
      disputedCount: result.disputedCount,
      isStale: result.isStale,
      registeredAt: result.registeredAt,
      daysSinceRegistered: result.daysSinceRegistered,
    };
  }
}
