import { Injectable } from '@nestjs/common';
import { BadgeCategory } from '../entities/badge-definition.entity';

export interface BadgeEvaluationContext {
  totalRegistrations: number;
  totalVerifications: number;
  trustScore: number;
  trustScoreMaintainedDays?: number;
}

@Injectable()
export class BadgeEvaluatorService {
  /**
   * 뱃지 정의 (마스터 데이터)
   */
  private badgeDefinitions = [
    // 등록 기반 뱃지
    {
      id: 'registration_10',
      category: BadgeCategory.REGISTRATION,
      name: '가격 탐험가',
      description: '가격 등록 10회',
      icon: '🔍',
      threshold: 10,
      rank: 1,
    },
    {
      id: 'registration_50',
      category: BadgeCategory.REGISTRATION,
      name: '가격 수집가',
      description: '가격 등록 50회',
      icon: '📦',
      threshold: 50,
      rank: 2,
    },
    {
      id: 'registration_200',
      category: BadgeCategory.REGISTRATION,
      name: '가격 전문가',
      description: '가격 등록 200회',
      icon: '🏆',
      threshold: 200,
      rank: 3,
    },
    {
      id: 'registration_500',
      category: BadgeCategory.REGISTRATION,
      name: '가격 마스터',
      description: '가격 등록 500회',
      icon: '👑',
      threshold: 500,
      rank: 4,
    },
    // 검증 기반 뱃지
    {
      id: 'verification_10',
      category: BadgeCategory.VERIFICATION,
      name: '가격 확인러',
      description: '검증 참여 10회',
      icon: '✅',
      threshold: 10,
      rank: 1,
    },
    {
      id: 'verification_50',
      category: BadgeCategory.VERIFICATION,
      name: '꼼꼼한 검증자',
      description: '검증 참여 50회',
      icon: '🔎',
      threshold: 50,
      rank: 2,
    },
    {
      id: 'verification_200',
      category: BadgeCategory.VERIFICATION,
      name: '검증 베테랑',
      description: '검증 참여 200회',
      icon: '🛡️',
      threshold: 200,
      rank: 3,
    },
    {
      id: 'verification_500',
      category: BadgeCategory.VERIFICATION,
      name: '검증 마스터',
      description: '검증 참여 500회',
      icon: '⚔️',
      threshold: 500,
      rank: 4,
    },
    // 신뢰도 기반 뱃지
    {
      id: 'trust_70_30',
      category: BadgeCategory.TRUST,
      name: '믿을 수 있는 이웃',
      description: '유저 신뢰도 70점 이상 30일 유지',
      icon: '🤝',
      threshold: 70,
      durationDays: 30,
      rank: 1,
    },
    {
      id: 'trust_85_60',
      category: BadgeCategory.TRUST,
      name: '동네 가격 지킴이',
      description: '유저 신뢰도 85점 이상 60일 유지',
      icon: '🏠',
      threshold: 85,
      durationDays: 60,
      rank: 2,
    },
    {
      id: 'trust_95_90',
      category: BadgeCategory.TRUST,
      name: '가격 수호자',
      description: '유저 신뢰도 95점 이상 90일 유지',
      icon: '💎',
      threshold: 95,
      durationDays: 90,
      rank: 3,
    },
  ];

  /**
   * 사용자가 획득할 수 있는 뱃지 계산
   */
  evaluateEarnedBadges(context: BadgeEvaluationContext): string[] {
    const earnedBadges: string[] = [];

    // 등록 기반 뱃지
    const registrationBadges = this.badgeDefinitions
      .filter((b) => b.category === BadgeCategory.REGISTRATION)
      .sort((a, b) => a.threshold - b.threshold);

    for (const badge of registrationBadges) {
      if (context.totalRegistrations >= badge.threshold) {
        earnedBadges.push(badge.id);
      }
    }

    // 검증 기반 뱃지
    const verificationBadges = this.badgeDefinitions
      .filter((b) => b.category === BadgeCategory.VERIFICATION)
      .sort((a, b) => a.threshold - b.threshold);

    for (const badge of verificationBadges) {
      if (context.totalVerifications >= badge.threshold) {
        earnedBadges.push(badge.id);
      }
    }

    // 신뢰도 기반 뱃지 (유지 기간 확인 필요)
    const trustBadges = this.badgeDefinitions.filter(
      (b) => b.category === BadgeCategory.TRUST,
    );

    for (const badge of trustBadges) {
      if (
        context.trustScore >= badge.threshold &&
        (context.trustScoreMaintainedDays ?? 0) >= badge.durationDays!
      ) {
        earnedBadges.push(badge.id);
      }
    }

    return earnedBadges;
  }

  /**
   * 사용자의 진행 중인 뱃지 계산 (아직 획득하지 못한 뱃지 중 진행률 표시)
   */
  evaluateProgressBadges(context: BadgeEvaluationContext): Array<{
    badgeId: string;
    current: number;
    threshold: number;
    progressPercent: number;
  }> {
    const progressBadges: Array<{
      badgeId: string;
      current: number;
      threshold: number;
      progressPercent: number;
    }> = [];

    // 등록 기반 진행 중인 뱃지
    const nextRegistrationBadge = this.badgeDefinitions
      .filter((b) => b.category === BadgeCategory.REGISTRATION)
      .sort((a, b) => a.threshold - b.threshold)
      .find((b) => context.totalRegistrations < b.threshold);

    if (nextRegistrationBadge) {
      progressBadges.push({
        badgeId: nextRegistrationBadge.id,
        current: context.totalRegistrations,
        threshold: nextRegistrationBadge.threshold,
        progressPercent: Math.round(
          (context.totalRegistrations / nextRegistrationBadge.threshold) * 100,
        ),
      });
    }

    // 검증 기반 진행 중인 뱃지
    const nextVerificationBadge = this.badgeDefinitions
      .filter((b) => b.category === BadgeCategory.VERIFICATION)
      .sort((a, b) => a.threshold - b.threshold)
      .find((b) => context.totalVerifications < b.threshold);

    if (nextVerificationBadge) {
      progressBadges.push({
        badgeId: nextVerificationBadge.id,
        current: context.totalVerifications,
        threshold: nextVerificationBadge.threshold,
        progressPercent: Math.round(
          (context.totalVerifications / nextVerificationBadge.threshold) * 100,
        ),
      });
    }

    return progressBadges;
  }

  /**
   * 뱃지 정의 조회
   */
  getBadgeDefinition(badgeId: string) {
    return this.badgeDefinitions.find((b) => b.id === badgeId);
  }

  /**
   * 모든 뱃지 정의 조회
   */
  getAllBadgeDefinitions() {
    return this.badgeDefinitions;
  }

  /**
   * 가장 높은 등급의 뱃지 조회 (대표 뱃지)
   */
  getRepresentativeBadge(earnedBadgeIds: string[]) {
    if (earnedBadgeIds.length === 0) {
      return null;
    }

    let highestBadge: ReturnType<typeof this.getBadgeDefinition> | null = null;
    let highestRank = -1;

    for (const badgeId of earnedBadgeIds) {
      const badge = this.getBadgeDefinition(badgeId);
      if (badge && badge.rank > highestRank) {
        highestRank = badge.rank;
        highestBadge = badge;
      }
    }

    return highestBadge;
  }
}
