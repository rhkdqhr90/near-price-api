import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserTrustScore } from './entities/user-trust-score.entity';
import { UserTrustScoreCalculator } from './services/user-trust-score.calculator';
import { PriceTrustScoreCalculator } from './services/price-trust-score.calculator';
import { User } from '../user/entities/user.entity';
import { PriceVerification } from '../price-verification/entities/price-verification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserTrustScore, User, PriceVerification]),
  ],
  providers: [UserTrustScoreCalculator, PriceTrustScoreCalculator],
  exports: [UserTrustScoreCalculator, PriceTrustScoreCalculator],
})
export class TrustScoreModule {}
