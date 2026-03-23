import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BadgeDefinition } from './entities/badge-definition.entity';
import { UserBadge } from './entities/user-badge.entity';
import { BadgeEvaluatorService } from './services/badge-evaluator.service';
import { BadgeController } from './badge.controller';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BadgeDefinition, UserBadge, User])],
  controllers: [BadgeController],
  providers: [BadgeEvaluatorService],
  exports: [BadgeEvaluatorService],
})
export class BadgeModule {}
