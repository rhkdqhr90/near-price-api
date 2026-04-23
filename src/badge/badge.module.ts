import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BadgeDefinition } from './entities/badge-definition.entity';
import { UserBadge } from './entities/user-badge.entity';
import { BadgeEvaluatorService } from './services/badge-evaluator.service';
import { BadgeService } from './badge.service';
import { BadgeController } from './badge.controller';
import { User } from '../user/entities/user.entity';
import { UserTrustScore } from '../trust-score/entities/user-trust-score.entity';
import { PriceVerification } from '../price-verification/entities/price-verification.entity';
import { PointWallet } from '../point/entities/point-wallet.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BadgeDefinition,
      UserBadge,
      User,
      UserTrustScore,
      PriceVerification,
      PointWallet,
    ]),
  ],
  controllers: [BadgeController],
  providers: [BadgeEvaluatorService, BadgeService],
  exports: [BadgeEvaluatorService],
})
export class BadgeModule {}
