import { Module } from '@nestjs/common';
import { PriceController } from './price.controller';
import { PriceService } from './price.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Price } from './entities/price.entity';
import { Store } from '../store/entities/store.entity';
import { Product } from '../product/entities/product.entity';
import { User } from '../user/entities/user.entity';
import { Wishlist } from '../wishlist/entities/wishlist.entity';
import { PriceReactionModule } from '../price-reaction/price-reaction.module';
import { NotificationModule } from '../notification/notification.module';
import { PointModule } from '../point/point.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Price, Store, Product, User, Wishlist]),
    PriceReactionModule,
    NotificationModule,
    PointModule,
  ],
  controllers: [PriceController],
  providers: [PriceService],
  exports: [TypeOrmModule],
})
export class PriceModule {}
