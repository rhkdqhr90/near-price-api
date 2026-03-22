import { Injectable } from '@nestjs/common';
import { VerificationResult } from '../../price-verification/entities/price-verification.entity';

export interface VerificationData {
  result: VerificationResult;
  verifierTrustScore: number;
}

export interface PriceTrustScoreResult {
  score: number | null;
  status: 'scored' | 'verifying' | 'new';
}

@Injectable()
export class PriceTrustScoreCalculator {
  /**
   * 가격 신뢰도 계산
   * PriceTrustScore = (Σ(w_i × v_i) / Σ(w_i)) × 100
   * - v_i: 검증 결과 (맞아요 = 1, 달라요 = 0)
   * - w_i: 검증자 신뢰도 가중치 = 0.5 + 0.5 × (UserTrustScore_i / 100)
   */
  calculatePriceTrustScore(
    verifications: VerificationData[],
  ): PriceTrustScoreResult {
    if (verifications.length === 0) {
      return { score: null, status: 'new' };
    }

    if (verifications.length < 10) {
      return { score: null, status: 'verifying' };
    }

    let weightedSum = 0;
    let weightTotal = 0;

    for (const v of verifications) {
      const weight = 0.5 + 0.5 * (v.verifierTrustScore / 100);
      const value = v.result === VerificationResult.CONFIRMED ? 1 : 0;
      weightedSum += weight * value;
      weightTotal += weight;
    }

    const score = Math.round((weightedSum / weightTotal) * 100 * 100) / 100;
    return { score, status: 'scored' };
  }

  /**
   * 30일 이상 경과한 가격 데이터인지 판별
   */
  isStalePrice(registeredAt: Date): boolean {
    const now = new Date();
    const diffMs = now.getTime() - registeredAt.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= 30;
  }

  /**
   * 가격 데이터가 등록된 후 경과 일수 계산
   */
  getDaysSinceRegistered(registeredAt: Date): number {
    const now = new Date();
    const diffMs = now.getTime() - registeredAt.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }
}
