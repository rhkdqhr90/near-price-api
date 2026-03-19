import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types/auth-user.type';
import { PriceService } from './price.service';
import { CreatePriceDto } from './dto/create-price.dto';
import { PriceResponseDto } from './dto/price-response.dto';
import { UpdatePriceDto } from './dto/update-price.dto';

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
  async findMine(@CurrentUser() user: AuthUser): Promise<PriceResponseDto[]> {
    return await this.priceService.findByUser(user.userId);
  }

  @Get('recent')
  async findRecent(): Promise<PriceResponseDto[]> {
    return await this.priceService.findRecent();
  }

  @Get('product/:productId')
  async findByProduct(
    @Param('productId') productId: string,
  ): Promise<PriceResponseDto[]> {
    return await this.priceService.findByProduct(productId);
  }

  @Get()
  async findAll(): Promise<PriceResponseDto[]> {
    return await this.priceService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<PriceResponseDto> {
    return await this.priceService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updatePriceDto: UpdatePriceDto,
    @CurrentUser() user: AuthUser,
  ): Promise<PriceResponseDto> {
    return await this.priceService.update(id, updatePriceDto, user.userId);
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deactivate(@Param('id') id: string): Promise<void> {
    await this.priceService.deactivate(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.priceService.remove(id, user.userId);
  }
}
