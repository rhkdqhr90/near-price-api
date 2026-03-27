import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriceVerificationService } from './price-verification.service';
import { PriceVerificationController } from './price-verification.controller';
import { PriceVerification } from './entities/price-verification.entity';
import { Price } from '../price/entities/price.entity';
import { User } from '../user/entities/user.entity';
import { PriceTrustScoreCalculator } from '../trust-score/services/price-trust-score.calculator';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PriceVerification, Price, User]),
    NotificationModule,
  ],
  controllers: [PriceVerificationController],
  providers: [PriceVerificationService, PriceTrustScoreCalculator],
  exports: [PriceVerificationService, PriceTrustScoreCalculator],
})
export class PriceVerificationModule {}
