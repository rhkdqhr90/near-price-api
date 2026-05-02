import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadgeCategory } from '../entities/badge-definition.entity';
import { User } from '../../user/entities/user.entity';
import { PriceVerification } from '../../price-verification/entities/price-verification.entity';
import { UserBadgesResponseDto } from '../dto/user-badges-response.dto';
import { PointWallet } from '../../point/entities/point-wallet.entity';
import {
  BADGE_DEFINITIONS,
  BadgeEvaluationContext,
  BadgeRule,
} from '../data/badge-definitions';

/**
 * 사용자 활동 지표 → 뱃지 보유/진행도 평가.
 *
 * 메타데이터 단순 lookup(이름/아이콘 등)은 `BadgeRegistryService`를 사용한다 —
 * 이 서비스는 DB 쿼리를 동반하므로 핫패스(카드 빌더 등)에서 직접 호출하지 말 것.
 */
@Injectable()
export class BadgeEvaluatorService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PriceVerification)
    private readonly priceVerificationRepository: Repository<PriceVerification>,
    @InjectRepository(PointWallet)
    private readonly pointWalletRepository: Repository<PointWallet>,
  ) {}

  /**
   * 사용자 뱃지 정보 조회 (API 응답용).
   */
  async getUserBadges(userId: string): Promise<UserBadgesResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      return UserBadgesResponseDto.empty();
    }

    const [totalRegistrations, totalVerifications, totalPoints] =
      await Promise.all([
        this.userRepository
          .createQueryBuilder('u')
          .leftJoin('u.prices', 'p')
          .select('COUNT(p.id)', 'cnt')
          .where('u.id = :userId', { userId })
          .getRawOne<{ cnt: string }>()
          .then((r) => parseInt(r?.cnt ?? '0', 10)),
        this.priceVerificationRepository.countBy({
          verifier: { id: userId },
        }),
        this.pointWalletRepository
          .findOne({ where: { user: { id: userId } } })
          .then((wallet) => wallet?.lifetimeEarned ?? 0),
      ]);

    const daysSinceJoin = Math.floor(
      (Date.now() - (user.createdAt?.getTime() ?? Date.now())) /
        (1000 * 60 * 60 * 24),
    );

    const context: BadgeEvaluationContext = {
      totalRegistrations,
      totalVerifications,
      trustScore: user.trustScore ?? 0,
      totalPoints,
      trustScoreMaintainedDays: daysSinceJoin,
      daysSinceJoin,
    };

    const earned = BADGE_DEFINITIONS.filter((b) => b.evaluate(context)).map(
      (b) => ({
        type: b.id,
        name: b.name,
        icon: b.icon,
        category: b.category,
      }),
    );

    // 진행 중인 뱃지(아직 보유 X) — 카테고리별로 다음 단계 1개만 노출
    const earnedIds = new Set(earned.map((e) => e.type));
    const progressByCategory = new Map<BadgeCategory, BadgeRule>();
    for (const def of BADGE_DEFINITIONS) {
      if (earnedIds.has(def.id) || !def.progress) continue;
      const existing = progressByCategory.get(def.category);
      if (!existing || existing.rank > def.rank) {
        progressByCategory.set(def.category, def);
      }
    }
    const progress = Array.from(progressByCategory.values()).map((def) => {
      const p = def.progress!(context);
      return {
        type: def.id,
        name: def.name,
        icon: def.icon,
        category: def.category,
        current: p.current,
        threshold: p.threshold,
        progressPercent: Math.min(
          100,
          Math.round((p.current / Math.max(1, p.threshold)) * 100),
        ),
      };
    });

    return UserBadgesResponseDto.from(earned, progress);
  }

  /** 보유 뱃지 ID 목록 — `Set` 으로 반환해 호출 측 includes O(N) 회피 */
  async getEarnedBadgeIds(userId: string): Promise<Set<string>> {
    const result = await this.getUserBadges(userId);
    return new Set(result.earned.map((e) => e.type));
  }
}
