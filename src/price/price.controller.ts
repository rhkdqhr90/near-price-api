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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import { PriceService } from './price.service';
import { CreatePriceDto } from './dto/create-price.dto';
import { PriceResponseDto } from './dto/price-response.dto';
import { ProductPriceCardDto } from './dto/product-price-card.dto';
import { UpdatePriceDto } from './dto/update-price.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { SearchPriceByNameDto } from './dto/search-price-by-name.dto';

@Controller('price')
export class PriceController {
  constructor(private readonly priceService: PriceService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser() user: AuthUser,
    @Body() createPriceDto: CreatePriceDto,
  ): Promise<PriceResponseDto> {
    return await this.priceService.create(createPriceDto, user.userId);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async findMine(
    @CurrentUser() user: AuthUser,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<PriceResponseDto>> {
    return await this.priceService.findByUser(user.userId, pagination);
  }

  @Get('recent')
  async findRecent(
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<ProductPriceCardDto>> {
    return await this.priceService.findRecentByProduct(pagination);
  }

  @Get('product/:productId')
  async findByProduct(
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<PriceResponseDto[]> {
    return await this.priceService.findByProduct(productId);
  }

  @Get('by-name')
  async findByProductName(
    @Query() dto: SearchPriceByNameDto,
  ): Promise<PriceResponseDto[]> {
    return await this.priceService.findByProductName(dto.name);
  }

  @Get()
  async findAll(
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<PriceResponseDto>> {
    return await this.priceService.findAll(pagination);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PriceResponseDto> {
    return await this.priceService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePriceDto: UpdatePriceDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PriceResponseDto> {
    return await this.priceService.update(id, updatePriceDto, user.userId);
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.priceService.deactivate(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.priceService.remove(id, user.userId);
  }
}
