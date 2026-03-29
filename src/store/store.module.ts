import { Module } from '@nestjs/common';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Store } from './entities/store.entity';
import { StoreReview } from './entities/store-review.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Store, StoreReview, User])],
  controllers: [StoreController],
  providers: [StoreService],
  exports: [TypeOrmModule],
})
export class StoreModule {}
