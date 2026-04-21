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
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import {
  SearchProductQueryDto,
  SearchProductResponseDto,
} from './dto/search-product.dto';

@Controller('product')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() createProductDto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    return await this.productService.create(createProductDto);
  }

  // GET /product/popular-tags — 인기 검색 태그 (price 등록 빈도 기반)
  @Get('popular-tags')
  @Throttle({ search: { limit: 30, ttl: 60000 } })
  async popularTags(): Promise<string[]> {
    return await this.productService.findPopularTags();
  }

  // GET /product/search?q=keyword — (반드시 :id 라우터보다 위에 위치)
  @Get('search')
  @Throttle({ search: { limit: 30, ttl: 60000 } })
  async search(
    @Query() query: SearchProductQueryDto,
  ): Promise<SearchProductResponseDto[]> {
    return await this.productService.search(query.q, query.limit);
  }

  // POST /product/search/sync — 전체 상품 ES 벌크 색인 (어드민 전용)
  @Post('search/sync')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, AdminGuard)
  async syncSearch(): Promise<{ indexed: number }> {
    return await this.productService.syncSearch();
  }

  @Get()
  async findAll(
    @Query('search') search?: string,
  ): Promise<ProductResponseDto[]> {
    return await this.productService.findAll(search);
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ProductResponseDto> {
    return await this.productService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return await this.productService.update(id, updateProductDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.productService.remove(id);
  }
}
