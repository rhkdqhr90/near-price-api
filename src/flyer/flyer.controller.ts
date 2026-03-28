import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { FlyerService } from './flyer.service';
import { CreateFlyerDto } from './dto/create-flyer.dto';
import { UpdateFlyerDto } from './dto/update-flyer.dto';
import { FlyerResponseDto } from './dto/flyer-response.dto';
import { CreateOwnerPostDto } from './dto/create-owner-post.dto';
import { UpdateOwnerPostDto } from './dto/update-owner-post.dto';
import { OwnerPostResponseDto } from './dto/owner-post-response.dto';

@Controller('flyer')
export class FlyerController {
  constructor(private readonly flyerService: FlyerService) {}

  // ─── Flyers ──────────────────────────────────────────────────────────────

  @Get()
  async findAll(): Promise<FlyerResponseDto[]> {
    return await this.flyerService.findAllFlyers();
  }

  // 주의: :id 보다 반드시 위에 위치해야 함 (라우트 충돌 방지)
  @Get('owner-posts/list')
  async findAllOwnerPosts(): Promise<OwnerPostResponseDto[]> {
    return await this.flyerService.findAllOwnerPosts();
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FlyerResponseDto> {
    return await this.flyerService.findOneFlyer(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async create(@Body() dto: CreateFlyerDto): Promise<FlyerResponseDto> {
    return await this.flyerService.createFlyer(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFlyerDto,
  ): Promise<FlyerResponseDto> {
    return await this.flyerService.updateFlyer(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.flyerService.removeFlyer(id);
  }

  // ─── Owner Posts ──────────────────────────────────────────────────────────

  @Post('owner-posts')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createOwnerPost(
    @Body() dto: CreateOwnerPostDto,
  ): Promise<OwnerPostResponseDto> {
    return await this.flyerService.createOwnerPost(dto);
  }

  @Patch('owner-posts/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateOwnerPost(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOwnerPostDto,
  ): Promise<OwnerPostResponseDto> {
    return await this.flyerService.updateOwnerPost(id, dto);
  }

  @Delete('owner-posts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async removeOwnerPost(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.flyerService.removeOwnerPost(id);
  }
}
