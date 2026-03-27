import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserTrustScore } from '../trust-score/entities/user-trust-score.entity';
import { User } from '../user/entities/user.entity';

@Injectable()
export class BadgeService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserTrustScore)
    private readonly trustScoreRepository: Repository<UserTrustScore>,
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
}
