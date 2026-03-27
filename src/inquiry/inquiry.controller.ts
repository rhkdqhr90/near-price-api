import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { InquiryService } from './inquiry.service';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { InquiryResponseDto } from './dto/inquiry-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';

@Controller('inquiry')
export class InquiryController {
  constructor(private readonly inquiryService: InquiryService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() createInquiryDto: CreateInquiryDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<InquiryResponseDto> {
    return await this.inquiryService.create(createInquiryDto, authUser.userId);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async findByUser(
    @CurrentUser() authUser: AuthUser,
  ): Promise<InquiryResponseDto[]> {
    return await this.inquiryService.findByUser(authUser.userId);
  }
}
