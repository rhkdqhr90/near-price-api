import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { PriceService } from './price.service';
import { CreatePriceDto } from './dto/create-price.dto';
import { PriceResponseDto } from './dto/price-response.dto';
import { UpdatePriceDto } from './dto/update-price.dto';

@Controller('price')
export class PriceController {
  constructor(private readonly priceService: PriceService) {}

  @Post()
  async create(
    @Body() createPriceDto: CreatePriceDto,
  ): Promise<PriceResponseDto> {
    return await this.priceService.create(createPriceDto);
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
  async update(
    @Param('id') id: string,
    @Body() updatePriceDto: UpdatePriceDto,
  ): Promise<PriceResponseDto> {
    return await this.priceService.update(id, updatePriceDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    await this.priceService.remove(id);
  }
}
