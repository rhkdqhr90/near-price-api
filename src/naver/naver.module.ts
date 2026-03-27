import { Module } from '@nestjs/common';
import { NaverController } from './naver.controller';
import { NaverService } from './naver.service';

@Module({
  controllers: [NaverController],
  providers: [NaverService],
})
export class NaverModule {}
