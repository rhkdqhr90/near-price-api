import { Injectable } from '@nestjs/common';

export interface UserTrustScoreComponents {
  registrationScore: number;
  verificationScore: number;
  consistencyBonus: number;
  totalRegistrations: number;
  totalVerifications: number;
  activeDays: number;
}

export interface UserTrustScoreResult {
  trustScore: number;
  registrationScore: number;
  verificationScore: number;
  consistencyBonus: number;
}

@Injectable()
export class UserTrustScoreCalculator {
  private readonly ALPHA = 0.5; // 등록 활동 비중
  private readonly BETA = 0.3; // 검증 활동 비중
  private readonly GAMMA = 0.2; // 일관성 보너스 비중

  /**
   * 유저 신뢰도 계산
   * UserTrustScore = α × RegistrationScore + β × VerificationScore + γ × ConsistencyBonus
   */
  calculateUserTrustScore(
    components: UserTrustScoreComponents,
  ): UserTrustScoreResult {
    const registrationScore = this.calculateRegistrationScore(
      components.registrationScore,
      components.totalRegistrations,
    );
    const verificationScore = this.calculateVerificationScore(
      components.verificationScore,
      components.totalVerifications,
    );
    const consistencyBonus = this.calculateConsistencyBonus(
      components.activeDays,
    );

    // 활동 건수가 5 미만이면 기본값 50 유지
    if (components.totalRegistrations + components.totalVerifications < 5) {
      return {
        trustScore: 50,
        registrationScore: 50,
        verificationScore: 50,
        consistencyBonus: 0,
      };
    }

    const trustScore = Math.round(
      this.ALPHA * registrationScore +
        this.BETA * verificationScore +
        this.GAMMA * consistencyBonus,
    );

    return {
      trustScore: Math.min(100, Math.max(0, trustScore)),
      registrationScore,
      verificationScore,
      consistencyBonus,
    };
  }

  /**
   * 등록 점수: 최근 90일 이내 등록한 가격의 평균 신뢰도
   */
  private calculateRegistrationScore(
    averagePriceTrustScore: number,
    registrationCount: number,
  ): number {
    if (registrationCount === 0) {
      return 50;
    }
    return Math.round(averagePriceTrustScore);
  }

  /**
   * 검증 점수: 다수 의견과 일치한 검증의 비율
   */
  private calculateVerificationScore(
    alignmentRatio: number,
    verificationCount: number,
  ): number {
    if (verificationCount === 0) {
      return 50;
    }
    return Math.round(alignmentRatio);
  }

  /**
   * 일관성 보너스: 최근 30일 활동 일수에 따른 보너스
   * ConsistencyBonus = min(100, ActiveDays × (100 / 15))
   */
  private calculateConsistencyBonus(activeDays: number): number {
    const bonus = activeDays * (100 / 15);
    return Math.min(100, Math.round(bonus));
  }
}
