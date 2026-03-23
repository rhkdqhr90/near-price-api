import { Controller, Post, Get, Body, UseGuards, Inject } from '@nestjs/common';
import { InquiryService } from './inquiry.service';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { InquiryResponseDto } from './dto/inquiry-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

@Controller('inquiry')
export class InquiryController {
  constructor(
    private readonly inquiryService: InquiryService,
    @Inject(getRepositoryToken(User))
    private readonly userRepository: Repository<User>,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() createInquiryDto: CreateInquiryDto,
    @CurrentUser() authUser: AuthUser,
  ): Promise<InquiryResponseDto> {
    const user = await this.userRepository.findOneBy({ id: authUser.userId });
    return this.inquiryService.create(createInquiryDto, user || undefined);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async findByUser(@CurrentUser() authUser: AuthUser): Promise<InquiryResponseDto[]> {
    return this.inquiryService.findByUser(authUser.userId);
  }
}
