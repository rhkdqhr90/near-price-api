import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InquiryService } from './inquiry.service';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { InquiryResponseDto } from './dto/inquiry-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import { ReplyInquiryDto } from './dto/reply-inquiry.dto';

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

  @Get('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async findAll(): Promise<InquiryResponseDto[]> {
    return await this.inquiryService.findAll();
  }

  @Patch(':id/reply')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async reply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() replyInquiryDto: ReplyInquiryDto,
  ): Promise<InquiryResponseDto> {
    return await this.inquiryService.reply(id, replyInquiryDto);
  }
}
