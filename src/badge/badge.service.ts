import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTrustScore } from '../trust-score/entities/user-trust-score.entity';
import { User } from '../user/entities/user.entity';
import { BadgeEvaluatorService } from './services/badge-evaluator.service';

export interface RepresentativeBadgeView {
  type: string;
  name: string;
}

@Injectable()
export class BadgeService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserTrustScore)
    private readonly trustScoreRepository: Repository<UserTrustScore>,
    private readonly badgeEvaluatorService: BadgeEvaluatorService,
  ) {}

  async getUserTrustScore(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    const trustScore = await this.trustScoreRepository.findOne({
      where: { user: { id: userId } },
    });

    return {
      userId,
      trustScore: trustScore?.trustScore ?? user.trustScore ?? 0,
      registrationScore: trustScore?.registrationScore ?? 50,
      verificationScore: trustScore?.verificationScore ?? 50,
      consistencyBonus: trustScore?.consistencyBonus ?? 0,
      totalRegistrations: trustScore?.totalRegistrations ?? 0,
      totalVerifications: trustScore?.totalVerifications ?? 0,
      calculatedAt: trustScore?.calculatedAt ?? new Date(),
    };
  }

  /**
   * 사용자의 대표 뱃지를 설정하거나 해제한다.
   *  - type=null  → 해제
   *  - 보유하지 않은 뱃지 type → 400
   *  - 알 수 없는 뱃지 type → 400
   */
  async setRepresentativeBadge(
    userId: string,
    type: string | null,
  ): Promise<RepresentativeBadgeView | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    if (type === null) {
      user.representativeBadgeId = null;
      await this.userRepository.save(user);
      return null;
    }

    const def = this.badgeEvaluatorService.getBadgeDefinition(type);
    if (!def) {
      throw new BadRequestException('알 수 없는 뱃지입니다');
    }

    const earnedIds =
      await this.badgeEvaluatorService.getEarnedBadgeIds(userId);
    if (!earnedIds.includes(type)) {
      throw new BadRequestException('보유하지 않은 뱃지입니다');
    }

    user.representativeBadgeId = type;
    await this.userRepository.save(user);

    return { type: def.id, name: def.name };
  }

  /**
   * 사용자의 현재 대표 뱃지를 조회한다.
   *  - 미설정 또는 알 수 없는 type → null
   *  - 보유 상태 검증은 응답 시점에 보수적으로 한 번 더 체크 (뱃지 시스템 변경/박탈 대비)
   */
  async getRepresentativeBadge(
    userId: string,
  ): Promise<RepresentativeBadgeView | null> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.representativeBadgeId) {
      return null;
    }

    const def = this.badgeEvaluatorService.getBadgeDefinition(
      user.representativeBadgeId,
    );
    if (!def) {
      return null;
    }

    return { type: def.id, name: def.name };
  }
}
