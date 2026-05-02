import { Module, forwardRef } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserOauth } from './entities/user-oauth.entity';
import { User } from './entities/user.entity';
import { Price } from '../price/entities/price.entity';
import { BadgeModule } from '../badge/badge.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserOauth, Price]),
    forwardRef(() => BadgeModule),
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [TypeOrmModule],
})
export class UserModule {}
