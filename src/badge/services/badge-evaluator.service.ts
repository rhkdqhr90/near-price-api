import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadgeCategory, BadgeTier } from '../entities/badge-definition.entity';
import { User } from '../../user/entities/user.entity';
import { PriceVerification } from '../../price-verification/entities/price-verification.entity';
import { UserBadgesResponseDto } from '../dto/user-badges-response.dto';
import { PointWallet } from '../../point/entities/point-wallet.entity';

/**
 * 사용자의 누적 활동 지표. 새 23개 뱃지 평가 컨텍스트.
 *
 * 디자인 시안엔 다양한 조건이 있지만(예: 가격 비교 1000회, 예측 정확도 90%),
 * 추적 카운터가 백엔드에 없는 항목은 일단 미부여 처리한다. 추후 카운터 추가 시
 * `BADGE_DEFINITIONS`의 evaluate()를 보강하면 됨.
 */
export interface BadgeEvaluationContext {
  totalRegistrations: number;
  totalVerifications: number;
  trustScore: number;
  totalPoints?: number;
  trustScoreMaintainedDays?: number;
  /** 가입 후 경과 일수 (== createdAt 기반 계산) */
  daysSinceJoin?: number;
}

interface BadgeRule {
  id: string;
  tier: BadgeTier;
  category: BadgeCategory;
  name: string;
  description: string;
  icon: string;
  threshold: number;
  durationDays: number | null;
  rank: number; // 같은 카테고리 내 순서
  /** 컨텍스트로 획득 여부 평가. true면 보유. */
  evaluate: (ctx: BadgeEvaluationContext) => boolean;
  /** 진행도 표시용 (현재 값 / 임계치) — 없으면 진행 표시 안 함 */
  progress?: (ctx: BadgeEvaluationContext) => {
    current: number;
    threshold: number;
  };
}

/**
 * 23개 뱃지 정의 (디자인: masil-badges.jsx와 1:1).
 * cond 자연어는 description으로 노출되고, 실제 부여 조건은 evaluate()로 판정.
 *
 * 미구현 카운터는 보수적으로 false를 반환하여 미보유 처리.
 * 시간 기준이 필요한 항목(연속 365일 등)은 가입 후 경과일로 폴백 — 정확도는 떨어지나 화면 노출에는 충분.
 */
const BADGE_DEFINITIONS: BadgeRule[] = [
  // ─── BRONZE (입문, id 1-4) ─────────────────────────
  {
    id: 'masil_1',
    tier: BadgeTier.BRONZE,
    category: BadgeCategory.REGISTRATION,
    name: '새내기 복돌이',
    description: '회원가입 완료',
    icon: '🌱',
    threshold: 1,
    durationDays: null,
    rank: 1,
    evaluate: () => true,
  },
  {
    id: 'masil_2',
    tier: BadgeTier.BRONZE,
    category: BadgeCategory.REGISTRATION,
    name: '첫 거래',
    description: '가격 등록 1건',
    icon: '🧾',
    threshold: 1,
    durationDays: null,
    rank: 2,
    evaluate: (c) => c.totalRegistrations >= 1,
    progress: (c) => ({ current: c.totalRegistrations, threshold: 1 }),
  },
  {
    id: 'masil_3',
    tier: BadgeTier.BRONZE,
    category: BadgeCategory.REGISTRATION,
    name: '동네탐방',
    description: '매장 5곳 방문',
    icon: '📍',
    threshold: 5,
    durationDays: null,
    rank: 3,
    // "매장 5곳 방문" 카운터 미구현 → 가격 등록 5건으로 대체 (방문 = 등록 행위)
    evaluate: (c) => c.totalRegistrations >= 5,
    progress: (c) => ({ current: c.totalRegistrations, threshold: 5 }),
  },
  {
    id: 'masil_4',
    tier: BadgeTier.BRONZE,
    category: BadgeCategory.REGISTRATION,
    name: '영수증 마스터',
    description: '영수증 10장 등록',
    icon: '📜',
    threshold: 10,
    durationDays: null,
    rank: 4,
    evaluate: (c) => c.totalRegistrations >= 10,
    progress: (c) => ({ current: c.totalRegistrations, threshold: 10 }),
  },
  // ─── SILVER (활동, id 5-8) ─────────────────────────
  {
    id: 'masil_5',
    tier: BadgeTier.SILVER,
    category: BadgeCategory.REGISTRATION,
    name: '알뜰 사냥꾼',
    description: '최저가 발견 10건',
    icon: '🎯',
    threshold: 10,
    durationDays: null,
    rank: 5,
    // "최저가 발견" 별도 카운터 미구현 → 검증 10건으로 폴백
    evaluate: (c) => c.totalVerifications >= 10,
    progress: (c) => ({ current: c.totalVerifications, threshold: 10 }),
  },
  {
    id: 'masil_6',
    tier: BadgeTier.SILVER,
    category: BadgeCategory.REGISTRATION,
    name: '카메라맨',
    description: 'OCR 등록 30건',
    icon: '📸',
    threshold: 30,
    durationDays: null,
    rank: 6,
    // OCR 사용 카운터 미구현 → 등록 30건으로 폴백
    evaluate: (c) => c.totalRegistrations >= 30,
    progress: (c) => ({ current: c.totalRegistrations, threshold: 30 }),
  },
  {
    id: 'masil_7',
    tier: BadgeTier.SILVER,
    category: BadgeCategory.REGISTRATION,
    name: '골목대장',
    description: '동네 등록 1위',
    icon: '👑',
    threshold: 50,
    durationDays: null,
    rank: 7,
    // 동네 1위 랭킹 미구현 → 등록 50건으로 폴백
    evaluate: (c) => c.totalRegistrations >= 50,
    progress: (c) => ({ current: c.totalRegistrations, threshold: 50 }),
  },
  {
    id: 'masil_8',
    tier: BadgeTier.SILVER,
    category: BadgeCategory.VERIFICATION,
    name: '시세 박사',
    description: '품목 30개 추적',
    icon: '📊',
    threshold: 30,
    durationDays: null,
    rank: 8,
    // 품목 추적 카운터 미구현 → 검증 30건으로 폴백
    evaluate: (c) => c.totalVerifications >= 30,
    progress: (c) => ({ current: c.totalVerifications, threshold: 30 }),
  },
  // ─── GOLD (숙련, id 9, 10, 11, 16, 17) ─────────────
  {
    id: 'masil_9',
    tier: BadgeTier.GOLD,
    category: BadgeCategory.REGISTRATION,
    name: '황금 영수증',
    description: '가격 등록 100건',
    icon: '🏆',
    threshold: 100,
    durationDays: null,
    rank: 9,
    evaluate: (c) => c.totalRegistrations >= 100,
    progress: (c) => ({ current: c.totalRegistrations, threshold: 100 }),
  },
  {
    id: 'masil_10',
    tier: BadgeTier.GOLD,
    category: BadgeCategory.TRUST,
    name: '시장의 등불',
    description: '채택률 80% 이상',
    icon: '🪔',
    threshold: 80,
    durationDays: null,
    rank: 10,
    // 채택률 별도 지표 미구현 → trustScore ≥ 80 폴백
    evaluate: (c) => c.trustScore >= 80,
    progress: (c) => ({ current: c.trustScore, threshold: 80 }),
  },
  {
    id: 'masil_11',
    tier: BadgeTier.GOLD,
    category: BadgeCategory.TRUST,
    name: '신뢰의 인장',
    description: '정확도 95% 이상',
    icon: '🛡️',
    threshold: 95,
    durationDays: null,
    rank: 11,
    evaluate: (c) => c.trustScore >= 95,
    progress: (c) => ({ current: c.trustScore, threshold: 95 }),
  },
  {
    id: 'masil_16',
    tier: BadgeTier.GOLD,
    category: BadgeCategory.VERIFICATION,
    name: '황금 저울',
    description: '가격 비교 1,000회',
    icon: '⚖️',
    threshold: 1000,
    durationDays: null,
    rank: 12,
    evaluate: (c) => c.totalVerifications >= 1000,
    progress: (c) => ({ current: c.totalVerifications, threshold: 1000 }),
  },
  {
    id: 'masil_17',
    tier: BadgeTier.GOLD,
    category: BadgeCategory.TRUST,
    name: '시장의 학자',
    description: '연속 365일 활동',
    icon: '📚',
    threshold: 365,
    durationDays: 365,
    rank: 13,
    evaluate: (c) => (c.daysSinceJoin ?? 0) >= 365,
    progress: (c) => ({
      current: c.daysSinceJoin ?? 0,
      threshold: 365,
    }),
  },
  // ─── PLATINUM (헌신, id 12, 13, 18, 19, 20) ─────────
  {
    id: 'masil_12',
    tier: BadgeTier.PLATINUM,
    category: BadgeCategory.REGISTRATION,
    name: '전단지 마스터',
    description: '전단지 50개 공유',
    icon: '🗞️',
    threshold: 50,
    durationDays: null,
    rank: 14,
    // 전단지 카운터 미구현 → trustScore ≥ 90 폴백
    evaluate: (c) => c.trustScore >= 90,
    progress: (c) => ({ current: c.trustScore, threshold: 90 }),
  },
  {
    id: 'masil_13',
    tier: BadgeTier.PLATINUM,
    category: BadgeCategory.POINT,
    name: '동네 전설',
    description: '누적 절약 100만원',
    icon: '💎',
    threshold: 5000,
    durationDays: null,
    rank: 15,
    // 절약 누적 카운터 미구현 → 포인트 5000 폴백
    evaluate: (c) => (c.totalPoints ?? 0) >= 5000,
    progress: (c) => ({ current: c.totalPoints ?? 0, threshold: 5000 }),
  },
  {
    id: 'masil_18',
    tier: BadgeTier.PLATINUM,
    category: BadgeCategory.REGISTRATION,
    name: '매장 정복자',
    description: '매장 100곳 방문',
    icon: '🏘️',
    threshold: 100,
    durationDays: null,
    rank: 16,
    evaluate: (c) => c.totalRegistrations >= 200,
    progress: (c) => ({ current: c.totalRegistrations, threshold: 200 }),
  },
  {
    id: 'masil_19',
    tier: BadgeTier.PLATINUM,
    category: BadgeCategory.TRUST,
    name: '시간의 증인',
    description: '1주년 + 활동 유지',
    icon: '⏳',
    threshold: 365,
    durationDays: 365,
    rank: 17,
    evaluate: (c) =>
      (c.daysSinceJoin ?? 0) >= 365 && c.totalRegistrations >= 50,
    progress: (c) => ({
      current: c.daysSinceJoin ?? 0,
      threshold: 365,
    }),
  },
  {
    id: 'masil_20',
    tier: BadgeTier.PLATINUM,
    category: BadgeCategory.TRUST,
    name: '가격 예언자',
    description: '예측 정확도 90%',
    icon: '🔮',
    threshold: 90,
    durationDays: null,
    rank: 18,
    // 예측 시스템 미구현 → trustScore ≥ 95 폴백
    evaluate: (c) => c.trustScore >= 95,
    progress: (c) => ({ current: c.trustScore, threshold: 95 }),
  },
  // ─── MYTHIC (전설, id 14, 15, 21, 22, 23) ───────────
  {
    id: 'masil_14',
    tier: BadgeTier.MYTHIC,
    category: BadgeCategory.POINT,
    name: '만석꾼 복돌이',
    description: '1만 포인트 달성',
    icon: '🌟',
    threshold: 10000,
    durationDays: null,
    rank: 19,
    evaluate: (c) => (c.totalPoints ?? 0) >= 10000,
    progress: (c) => ({ current: c.totalPoints ?? 0, threshold: 10000 }),
  },
  {
    id: 'masil_15',
    tier: BadgeTier.MYTHIC,
    category: BadgeCategory.TRUST,
    name: '수호신 복돌이',
    description: '1주년 + 14뱃지 완성',
    icon: '🦅',
    threshold: 14,
    durationDays: 365,
    rank: 20,
    evaluate: (c) =>
      (c.daysSinceJoin ?? 0) >= 365 &&
      c.trustScore >= 95 &&
      c.totalRegistrations >= 100,
    progress: (c) => ({
      current: c.daysSinceJoin ?? 0,
      threshold: 365,
    }),
  },
  {
    id: 'masil_21',
    tier: BadgeTier.MYTHIC,
    category: BadgeCategory.POINT,
    name: '봉황 복돌이',
    description: '누적 절약 1,000만원',
    icon: '🔥',
    threshold: 50000,
    durationDays: null,
    rank: 21,
    evaluate: (c) => (c.totalPoints ?? 0) >= 50000,
    progress: (c) => ({ current: c.totalPoints ?? 0, threshold: 50000 }),
  },
  {
    id: 'masil_22',
    tier: BadgeTier.MYTHIC,
    category: BadgeCategory.REGISTRATION,
    name: '황금 도깨비',
    description: '가격 등록 1,000건',
    icon: '👹',
    threshold: 1000,
    durationDays: null,
    rank: 22,
    evaluate: (c) => c.totalRegistrations >= 1000,
    progress: (c) => ({ current: c.totalRegistrations, threshold: 1000 }),
  },
  {
    id: 'masil_23',
    tier: BadgeTier.MYTHIC,
    category: BadgeCategory.TRUST,
    name: '마실의 신',
    description: '전체 뱃지 + 채택 1만',
    icon: '🌌',
    threshold: 22,
    durationDays: null,
    rank: 23,
    // 다른 모든 22개 보유 + 검증 1만 회 (실제 매핑은 evaluator에서 보강)
    evaluate: (c) =>
      c.totalVerifications >= 10000 &&
      c.totalRegistrations >= 1000 &&
      c.trustScore >= 95,
  },
];

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
      return { earned: [], progress: [] };
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

    // 평가
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

    return { earned, progress };
  }

  /** 보유 뱃지 ID 목록 (다른 서비스에서 활용) */
  async getEarnedBadgeIds(userId: string): Promise<string[]> {
    const result = await this.getUserBadges(userId);
    return result.earned.map((e) => e.type);
  }

  /** 뱃지 정의 조회 — 모든 BadgeDefinition seed 데이터 참조용 */
  getBadgeDefinition(badgeId: string) {
    return BADGE_DEFINITIONS.find((b) => b.id === badgeId);
  }

  /** 모든 뱃지 정의 (시드/마이그레이션 등에서 사용) */
  getAllBadgeDefinitions() {
    return BADGE_DEFINITIONS;
  }
}
