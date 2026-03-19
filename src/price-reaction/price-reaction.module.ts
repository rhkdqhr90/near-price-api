import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Price } from '../price/entities/price.entity';
import { User } from '../user/entities/user.entity';
import { PriceReaction } from './entities/price-reaction.entity';
import { PriceReactionController } from './price-reaction.controller';
import { PriceReactionService } from './price-reaction.service';

@Module({
  imports: [TypeOrmModule.forFeature([PriceReaction, Price, User])],
  controllers: [PriceReactionController],
  providers: [PriceReactionService],
  exports: [PriceReactionService],
})
export class PriceReactionModule {}
