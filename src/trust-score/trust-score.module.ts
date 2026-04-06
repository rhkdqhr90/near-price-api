import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserTrustScore } from './entities/user-trust-score.entity';
import { UserTrustScoreCalculator } from './services/user-trust-score.calculator';
import { PriceTrustScoreCalculator } from './services/price-trust-score.calculator';
import { TrustScoreService } from './trust-score.service';
import { TrustScoreScheduler } from './trust-score.scheduler';
import { User } from '../user/entities/user.entity';
import { Price } from '../price/entities/price.entity';
import { PriceVerification } from '../price-verification/entities/price-verification.entity';
import { PriceReaction } from '../price-reaction/entities/price-reaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserTrustScore,
      User,
      Price,
      PriceVerification,
      PriceReaction,
    ]),
  ],
  providers: [
    UserTrustScoreCalculator,
    PriceTrustScoreCalculator,
    TrustScoreService,
    TrustScoreScheduler,
  ],
  exports: [
    UserTrustScoreCalculator,
    PriceTrustScoreCalculator,
    TrustScoreService,
  ],
})
export class TrustScoreModule {}
