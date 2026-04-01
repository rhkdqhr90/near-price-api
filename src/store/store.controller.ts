import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import { StoreService } from './store.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { NearbyStoreQueryDto } from './dto/nearby-store.dto';
import { CreateStoreReviewDto } from './dto/create-store-review.dto';
import { StoreReviewResponseDto } from './dto/store-review-response.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';

@Controller('store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ write: { limit: 10, ttl: 60000 } })
  async create(@Body() createStoreDto: CreateStoreDto) {
    return await this.storeService.create(createStoreDto);
  }

  @Get()
  async findAll(@Query() pagination: PaginationDto) {
    return await this.storeService.findAll(pagination);
  }

  @Get('search')
  @Throttle({ search: { limit: 30, ttl: 60000 } })
  async searchByName(@Query('name') name: string) {
    if (!name || name.trim().length < 1) return [];
    if (name.length > 100)
      throw new BadRequestException('검색어는 100자 이하여야 합니다.');
    return await this.storeService.searchByName(name.trim());
  }

  @Get('nearby')
  async findNearby(@Query() query: NearbyStoreQueryDto) {
    return await this.storeService.findNearby(query);
  }

  @Get('by-external/:externalPlaceId')
  async findByExternal(@Param('externalPlaceId') externalPlaceId: string) {
    // externalPlaceId 길이 검증 (SQL Injection 방지)
    if (!externalPlaceId || externalPlaceId.length > 200) {
      throw new BadRequestException('Invalid externalPlaceId format');
    }
    return await this.storeService.findByExternalPlaceId(externalPlaceId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return await this.storeService.findOne(id);
  }

  @Post(':id/reviews')
  @UseGuards(JwtAuthGuard)
  @Throttle({ write: { limit: 5, ttl: 60000 } })
  async addReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateStoreReviewDto,
  ): Promise<StoreReviewResponseDto> {
    return await this.storeService.addReview(id, user.userId, dto);
  }

  // public endpoint — 비로그인 사용자도 매장 리뷰 조회 가능
  @Get(':id/reviews')
  async findReviews(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<StoreReviewResponseDto>> {
    return await this.storeService.findReviews(id, pagination);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStoreDto: UpdateStoreDto,
  ) {
    return await this.storeService.update(id, updateStoreDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return await this.storeService.remove(id);
  }
}
