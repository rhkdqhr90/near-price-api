import { Injectable, Logger } from '@nestjs/common';
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
export class TrustScoreService {
  private readonly logger = new Logger(TrustScoreService.name);

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

  // ────────────────────────────────────────────────────────────────────────────
  // 일괄 재계산 (TrustScoreScheduler 에서 호출)
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * 가격 신뢰도 → 사용자 신뢰도 순서로 일괄 재계산
   * (가격 점수를 사용자 점수 계산에 활용하기 때문에 순서가 중요)
   */
  async recalculateAll(): Promise<void> {
    await this.recalculateAllPriceTrustScores();
    await this.recalculateAllUserTrustScores();
  }

  /**
   * 검증 수 10건 이상인 가격의 신뢰도 재계산
   * 검증 데이터를 한 번에 일괄 조회하여 N+1 쿼리 방지
   */
  async recalculateAllPriceTrustScores(): Promise<void> {
    const prices = await this.priceRepository.find({
      where: { verificationCount: MoreThanOrEqual(10) },
    });

    if (prices.length === 0) {
      this.logger.log('가격 신뢰도 재계산: 대상 없음');
      return;
    }

    const priceIds = prices.map((p) => p.id);

    const allVerifications = await this.verificationRepository.find({
      where: { price: { id: In(priceIds) } },
      relations: ['verifier', 'price'],
    });

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
   * 전체 사용자의 신뢰도 재계산 (배치)
   *
   * 공식: UserTrustScore = α×RegistrationScore + β×VerificationScore + γ×ConsistencyBonus
   *   - α=0.5 : 최근 90일 등록 가격의 평균 신뢰도
   *   - β=0.3 : 최근 30일 검증 중 다수 의견과 일치한 비율
   *   - γ=0.2 : 최근 30일 활동 일수 기반 일관성 보너스
   *   - 총 활동 5건 미만이면 기본값 50 유지
   */
  async recalculateAllUserTrustScores(): Promise<void> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const users = await this.userRepository.find({ select: { id: true } });

    if (users.length === 0) return;

    const userIds = users.map((u) => u.id);

    const allRecentPrices = await this.priceRepository.find({
      where: {
        user: { id: In(userIds) },
        createdAt: MoreThanOrEqual(ninetyDaysAgo),
      },
      relations: ['user'],
    });

    const allRecentVerifications = await this.verificationRepository.find({
      where: {
        verifier: { id: In(userIds) },
        createdAt: MoreThanOrEqual(thirtyDaysAgo),
      },
      relations: ['verifier', 'price'],
    });

    const existingScores = await this.userTrustScoreRepository.find({
      where: { user: { id: In(userIds) } },
      relations: ['user'],
    });
    const existingScoreByUserId = new Map(
      existingScores.map((s) => [s.user.id, s]),
    );

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

    const userScoreUpdates: Array<{ id: string; trustScore: number }> = [];
    const trustScoreInserts: UserTrustScore[] = [];
    const trustScoreUpdates: Array<{
      id: string;
      data: Partial<UserTrustScore>;
    }> = [];

    for (const user of users) {
      const recentPrices = pricesByUserId.get(user.id) ?? [];
      const recentVerifications = verificationsByUserId.get(user.id) ?? [];

      const scoredPrices = recentPrices.filter((p) => p.trustScore !== null);
      const registrationScore =
        scoredPrices.length > 0
          ? scoredPrices.reduce((sum, p) => sum + (p.trustScore ?? 50), 0) /
            scoredPrices.length
          : 50;

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

      // KST 기준 일자 그룹핑 (UTC로 하면 한국 사용자 자정~09시 활동이 전날로 귀속됨)
      const toKstDateKey = (d: Date): string =>
        new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const activeDaySet = new Set<string>();
      recentPrices
        .filter((p) => p.createdAt >= thirtyDaysAgo)
        .forEach((p) => activeDaySet.add(toKstDateKey(p.createdAt)));
      recentVerifications.forEach((v) =>
        activeDaySet.add(toKstDateKey(v.createdAt)),
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
        trustScore: result.trustScore,
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

    if (trustScoreInserts.length > 0) {
      await this.userTrustScoreRepository.save(trustScoreInserts);
    }

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

  // ────────────────────────────────────────────────────────────────────────────
  // 내부 유틸
  // ────────────────────────────────────────────────────────────────────────────

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
