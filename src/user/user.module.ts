import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserOauth } from './entities/user-oauth.entity';
import { User } from './entities/user.entity';
import { Price } from '../price/entities/price.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserOauth, Price])],
  controllers: [UserController],
  providers: [UserService],
  exports: [TypeOrmModule],
})
export class UserModule {}
