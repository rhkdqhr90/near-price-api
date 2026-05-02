import { BadgeCategory, BadgeTier } from '../entities/badge-definition.entity';

/**
 * 사용자의 누적 활동 지표. 23개 뱃지 평가 컨텍스트.
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

export interface BadgeRule {
  id: string;
  tier: BadgeTier;
  category: BadgeCategory;
  name: string;
  description: string;
  icon: string;
  threshold: number;
  durationDays: number | null;
  rank: number;
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
 * 시간 기준이 필요한 항목(연속 365일 등)은 가입 후 경과일로 폴백.
 */
export const BADGE_DEFINITIONS: readonly BadgeRule[] = [
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
    evaluate: (c) =>
      c.totalVerifications >= 10000 &&
      c.totalRegistrations >= 1000 &&
      c.trustScore >= 95,
  },
];

/** O(1) 조회용 인덱스 — id → BadgeRule */
export const BADGE_DEFINITIONS_BY_ID: ReadonlyMap<string, BadgeRule> = new Map(
  BADGE_DEFINITIONS.map((b) => [b.id, b]),
);
