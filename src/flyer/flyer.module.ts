import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Flyer } from './entities/flyer.entity';
import { OwnerPost } from './entities/owner-post.entity';
import { User } from '../user/entities/user.entity';
import { FlyerService } from './flyer.service';
import { FlyerController } from './flyer.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Flyer, OwnerPost, User])],
  controllers: [FlyerController],
  providers: [FlyerService],
})
export class FlyerModule {}
