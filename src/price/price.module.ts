import { Module } from '@nestjs/common';
import { PriceController } from './price.controller';
import { PriceService } from './price.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Price } from './entities/price.entity';
import { Store } from '../store/entities/store.entity';
import { Product } from '../product/entities/product.entity';
import { User } from '../user/entities/user.entity';
import { PriceReactionModule } from '../price-reaction/price-reaction.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Price, Store, Product, User]),
    PriceReactionModule,
  ],
  controllers: [PriceController],
  providers: [PriceService],
  exports: [TypeOrmModule],
})
export class PriceModule {}
