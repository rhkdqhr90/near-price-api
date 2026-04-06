import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TrustScoreService } from './trust-score.service';

@Injectable()
export class TrustScoreScheduler {
  private readonly logger = new Logger(TrustScoreScheduler.name);

  constructor(private readonly trustScoreService: TrustScoreService) {}

  /**
   * 매일 새벽 3시 신뢰도 일괄 재계산
   * 순서: 가격 신뢰도 → 사용자 신뢰도 (가격 점수를 사용자 점수 계산에 활용)
   */
  @Cron('0 3 * * *')
  async recalculateAll(): Promise<void> {
    this.logger.log('Trust Score 일일 재계산 시작');
    try {
      await this.trustScoreService.recalculateAll();
      this.logger.log('Trust Score 일일 재계산 완료');
    } catch (err) {
      this.logger.error('Trust Score 재계산 중 오류 발생', err);
    }
  }
}
