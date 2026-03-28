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

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }

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

    const priceScoreUpdates: Array<{ id: string; trustScore: number }> = [];

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
        priceScoreUpdates.push({ id: price.id, trustScore: result.score });
      }
    }

    // 100개 청크씩 순차 처리 — DB 커넥션 풀 보호
    for (const chunk of this.chunkArray(priceScoreUpdates, 100)) {
      await Promise.all(
        chunk.map(({ id, trustScore }) =>
          this.priceRepository.update(id, { trustScore }),
        ),
      );
    }
    this.logger.log(`가격 신뢰도 재계산 완료: ${prices.length}건`);
  }

  /**
   * 전체 사용자의 신뢰도 재계산 (배치 쿼리로 N+1 방지)
   * - 유저 목록 / 가격 / 검증 / 기존 점수를 각 1회씩 조회
   * - registrationScore: 최근 90일 등록 가격의 평균 신뢰도
   * - verificationScore: 최근 30일 검증 중 다수 의견과 일치한 비율
   * - activeDays: 최근 30일 활동 일수 (가격 등록 + 검증 기준)
   */
  private async recalculateUserTrustScores(): Promise<void> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const users = await this.userRepository.find({ select: { id: true } });

    if (users.length === 0) return;

    const userIds = users.map((u) => u.id);

    // 배치 조회 1: 최근 90일 가격 전체 (userId별 그룹화용)
    const allRecentPrices = await this.priceRepository.find({
      where: {
        user: { id: In(userIds) },
        createdAt: MoreThanOrEqual(ninetyDaysAgo),
      },
      relations: ['user'],
    });

    // 배치 조회 2: 최근 30일 검증 전체 (userId별 그룹화용)
    const allRecentVerifications = await this.verificationRepository.find({
      where: {
        verifier: { id: In(userIds) },
        createdAt: MoreThanOrEqual(thirtyDaysAgo),
      },
      relations: ['verifier', 'price'],
    });

    // 배치 조회 3: 기존 UserTrustScore 전체
    const existingScores = await this.userTrustScoreRepository.find({
      where: { user: { id: In(userIds) } },
      relations: ['user'],
    });
    const existingScoreByUserId = new Map(
      existingScores.map((s) => [s.user.id, s]),
    );

    // userId별 그룹화 (메모리 내 처리)
    const pricesByUserId = new Map<string, Price[]>();
    for (const price of allRecentPrices) {
      if (!price.user) continue;
      const uid = price.user.id;
      const list = pricesByUserId.get(uid) ?? [];
      list.push(price);
      pricesByUserId.set(uid, list);
    }

    const verificationsByUserId = new Map<string, PriceVerification[]>();
    for (const v of allRecentVerifications) {
      if (!v.verifier) continue;
      const uid = v.verifier.id;
      const list = verificationsByUserId.get(uid) ?? [];
      list.push(v);
      verificationsByUserId.set(uid, list);
    }

    // 각 유저 계산 후 bulk write 준비
    const userScoreUpdates: Array<{ id: string; trustScore: number }> = [];
    const trustScoreInserts: UserTrustScore[] = [];
    const trustScoreUpdates: Array<{
      id: string;
      data: Partial<UserTrustScore>;
    }> = [];

    for (const user of users) {
      const recentPrices = pricesByUserId.get(user.id) ?? [];
      const recentVerifications = verificationsByUserId.get(user.id) ?? [];

      // registrationScore: 최근 90일 가격 중 점수가 있는 것의 평균
      const scoredPrices = recentPrices.filter((p) => p.trustScore !== null);
      const registrationScore =
        scoredPrices.length > 0
          ? scoredPrices.reduce((sum, p) => sum + (p.trustScore ?? 50), 0) /
            scoredPrices.length
          : 50;

      // verificationScore: 다수 의견과 일치한 검증 비율
      let alignedCount = 0;
      for (const v of recentVerifications) {
        if (!v.price) continue;
        const isConfirmedMajority =
          v.price.confirmedCount >= v.price.disputedCount;
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
        consistencyBonus: 0,
        totalRegistrations: recentPrices.length,
        totalVerifications: recentVerifications.length,
        activeDays: activeDaySet.size,
      });

      userScoreUpdates.push({
        id: user.id,
        trustScore: Math.round(result.trustScore),
      });

      const scoreData = {
        trustScore: result.trustScore,
        registrationScore: result.registrationScore,
        verificationScore: result.verificationScore,
        consistencyBonus: result.consistencyBonus,
        totalRegistrations: recentPrices.length,
        totalVerifications: recentVerifications.length,
      };

      const existing = existingScoreByUserId.get(user.id);
      if (existing) {
        trustScoreUpdates.push({ id: existing.id, data: scoreData });
      } else {
        trustScoreInserts.push(
          this.userTrustScoreRepository.create({
            user: { id: user.id } as User,
            ...scoreData,
          }),
        );
      }
    }

    // Bulk write: UserTrustScore insert
    if (trustScoreInserts.length > 0) {
      await this.userTrustScoreRepository.save(trustScoreInserts);
    }

    // Bulk write: UserTrustScore update + User.trustScore update (100개 청크씩 순차 처리 — DB 커넥션 풀 보호)
    const allUpdates = [
      ...trustScoreUpdates.map(
        ({ id, data }) =>
          () =>
            this.userTrustScoreRepository.update(id, data),
      ),
      ...userScoreUpdates.map(
        ({ id, trustScore }) =>
          () =>
            this.userRepository.update(id, { trustScore }),
      ),
    ];
    for (const chunk of this.chunkArray(allUpdates, 100)) {
      await Promise.all(chunk.map((fn) => fn()));
    }

    this.logger.log(`사용자 신뢰도 재계산 완료: ${users.length}명`);
  }
}
