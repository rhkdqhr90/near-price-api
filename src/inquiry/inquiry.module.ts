import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Inquiry } from './entities/inquiry.entity';
import { User } from '../user/entities/user.entity';
import { InquiryService } from './inquiry.service';
import { InquiryController } from './inquiry.controller';
import { InquiryMailService } from './inquiry-mail.service';

@Module({
  imports: [TypeOrmModule.forFeature([Inquiry, User])],
  controllers: [InquiryController],
  providers: [InquiryService, InquiryMailService],
})
export class InquiryModule {}
