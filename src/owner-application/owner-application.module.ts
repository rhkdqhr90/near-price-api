import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Store } from '../store/entities/store.entity';
import { User } from '../user/entities/user.entity';
import { OwnerApplicationController } from './owner-application.controller';
import { OwnerApplicationService } from './owner-application.service';
import { OwnerApplication } from './entities/owner-application.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OwnerApplication, User, Store])],
  controllers: [OwnerApplicationController],
  providers: [OwnerApplicationService],
  exports: [OwnerApplicationService],
})
export class OwnerApplicationModule {}
