import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, In } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Price } from '../price/entities/price.entity';
import {
  PriceVerification,
  VerificationResult,
} from '../price-verification/entities/price-verification.entity';
import { UserTrustScore } from './entities/user-trust-score.entity';
import { UserTrustScoreCalculator } from './services/user-trust-score.calculator';
import { PriceTrustScoreCalculator } from './services/price-trust-score.calculator';

@Injectable()
export class TrustScoreScheduler {
  private readonly logger = new Logger(TrustScoreScheduler.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Price)
    private readonly priceRepository: Repository<Price>,
    @InjectRepository(PriceVerification)
    private readonly verificationRepository: Repository<PriceVerification>,
    @InjectRepository(UserTrustScore)
    private readonly userTrustScoreRepository: Repository<UserTrustScore>,
    private readonly userTrustScoreCalculator: UserTrustScoreCalculator,
    private readonly priceTrustScoreCalculator: PriceTrustScoreCalculator,
  ) {}

  /**
   * 매일 새벽 3시 신뢰도 일괄 재계산
   * 순서: 가격 신뢰도 → 사용자 신뢰도 (가격 점수를 사용자 점수 계산에 활용)
   */
  @Cron('0 3 * * *')
  async recalculateAll(): Promise<void> {
    this.logger.log('Trust Score 일일 재계산 시작');
    try {
      await this.recalculatePriceTrustScores();
      await this.recalculateUserTrustScores();
      this.logger.log('Trust Score 일일 재계산 완료');
    } catch (err) {
      this.logger.error('Trust Score 재계산 중 오류 발생', err);
    }
  }

  /**
   * 검증 수 10건 이상인 가격의 신뢰도 재계산
   * 검증 데이터를 한 번에 일괄 조회하여 N+1 쿼리 방지
   */
  private async recalculatePriceTrustScores(): Promise<void> {
    const prices = await this.priceRepository.find({
      where: { verificationCount: MoreThanOrEqual(10) },
    });

    if (prices.length === 0) {
      this.logger.log('가격 신뢰도 재계산: 대상 없음');
      return;
    }

    const priceIds = prices.map((p) => p.id);

    // 한 번에 모든 검증 데이터 조회 (N+1 방지)
    const allVerifications = await this.verificationRepository.find({
      where: { price: { id: In(priceIds) } },
      relations: ['verifier', 'price'],
    });

    // priceId별로 그룹화
    const verificationsByPriceId = new Map<string, PriceVerification[]>();
    for (const v of allVerifications) {
      const priceId = v.price.id;
      const existing = verificationsByPriceId.get(priceId) ?? [];
      existing.push(v);
      verificationsByPriceId.set(priceId, existing);
    }

    for (const price of prices) {
      const verifications = verificationsByPriceId.get(price.id) ?? [];
      const verificationData = verifications.map((v) => ({
        result: v.result,
        verifierTrustScore: v.verifier?.trustScore ?? 50,
      }));
      const result =
        this.priceTrustScoreCalculator.calculatePriceTrustScore(
          verificationData,
        );
      if (result.status === 'scored' && result.score !== null) {
        await this.priceRepository.update(price.id, {
          trustScore: result.score,
        });
      }
    }
    this.logger.log(`가격 신뢰도 재계산 완료: ${prices.length}건`);
  }

  /**
   * 전체 사용자의 신뢰도 재계산
   * - DB 쿼리에 날짜 조건 적용으로 메모리 사용량 최소화
   * - registrationScore: 최근 90일 등록 가격의 평균 신뢰도
   * - verificationScore: 최근 30일 검증 중 다수 의견과 일치한 비율
   * - activeDays: 최근 30일 활동 일수 (가격 등록 + 검증 기준)
   */
  private async recalculateUserTrustScores(): Promise<void> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const users = await this.userRepository.find();

    for (const user of users) {
      // 최근 90일 가격 — DB에서 날짜 필터링 (메모리 전체 로드 방지)
      const recentPrices = await this.priceRepository.find({
        where: {
          user: { id: user.id },
          createdAt: MoreThanOrEqual(ninetyDaysAgo),
        },
      });

      // registrationScore: 최근 90일 가격 중 점수가 있는 것의 평균
      const scoredPrices = recentPrices.filter((p) => p.trustScore !== null);
      const registrationScore =
        scoredPrices.length > 0
          ? scoredPrices.reduce((sum, p) => sum + (p.trustScore ?? 50), 0) /
            scoredPrices.length
          : 50;

      // 최근 30일 검증 내역 — DB에서 날짜 필터링
      const recentVerifications = await this.verificationRepository.find({
        where: {
          verifier: { id: user.id },
          createdAt: MoreThanOrEqual(thirtyDaysAgo),
        },
        relations: ['price'],
      });

      // verificationScore: 다수 의견과 일치한 검증 비율
      let alignedCount = 0;
      for (const v of recentVerifications) {
        if (!v.price) continue;
        const isConfirmedMajority =
          v.price.confirmedCount > v.price.disputedCount;
        const userConfirmed = v.result === VerificationResult.CONFIRMED;
        if (isConfirmedMajority === userConfirmed) alignedCount++;
      }
      const verificationScore =
        recentVerifications.length > 0
          ? (alignedCount / recentVerifications.length) * 100
          : 50;

      // activeDays: 최근 30일 중 활동이 있었던 날짜 수
      const activeDaySet = new Set<string>();
      recentPrices
        .filter((p) => p.createdAt >= thirtyDaysAgo)
        .forEach((p) =>
          activeDaySet.add(p.createdAt.toISOString().slice(0, 10)),
        );
      recentVerifications.forEach((v) =>
        activeDaySet.add(v.createdAt.toISOString().slice(0, 10)),
      );

      const result = this.userTrustScoreCalculator.calculateUserTrustScore({
        registrationScore,
        verificationScore,
        consistencyBonus: 0, // 내부에서 activeDays로 재계산
        totalRegistrations: recentPrices.length,
        totalVerifications: recentVerifications.length,
        activeDays: activeDaySet.size,
      });

      // UserTrustScore upsert
      const existing = await this.userTrustScoreRepository.findOne({
        where: { user: { id: user.id } },
      });
      if (existing) {
        await this.userTrustScoreRepository.update(existing.id, {
          trustScore: result.trustScore,
          registrationScore: result.registrationScore,
          verificationScore: result.verificationScore,
          consistencyBonus: result.consistencyBonus,
          totalRegistrations: recentPrices.length,
          totalVerifications: recentVerifications.length,
        });
      } else {
        await this.userTrustScoreRepository.save(
          this.userTrustScoreRepository.create({
            user,
            trustScore: result.trustScore,
            registrationScore: result.registrationScore,
            verificationScore: result.verificationScore,
            consistencyBonus: result.consistencyBonus,
            totalRegistrations: recentPrices.length,
            totalVerifications: recentVerifications.length,
          }),
        );
      }

      // User.trustScore 정수 업데이트 (빠른 조회용)
      await this.userRepository.update(user.id, {
        trustScore: Math.round(result.trustScore),
      });
    }
    this.logger.log(`사용자 신뢰도 재계산 완료: ${users.length}명`);
  }
}
