import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductSearchService } from './product-search.service';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    private readonly productSearchService: ProductSearchService,
  ) {}

  async create(
    createProductDto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    const create = this.productRepository.create(createProductDto);
    const saved = await this.productRepository.save(create);
    await this.productSearchService.indexProduct(saved);
    return ProductResponseDto.from(saved);
  }

  async findAll(search?: string): Promise<ProductResponseDto[]> {
    const products = await this.productRepository.find({
      where: search ? { name: ILike(`%${search}%`) } : undefined,
      order: { name: 'ASC' },
    });
    return products.map((product) => ProductResponseDto.from(product));
  }

  async findOne(id: string): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({ where: { id } });

    if (!product) {
      throw new NotFoundException('존재하지 않는 상품입니다');
    }

    return ProductResponseDto.from(product);
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({ where: { id } });

    if (!product) {
      throw new NotFoundException('존재하지 않는 상품입니다');
    }
    const updateProduct = { ...product, ...updateProductDto };
    const saved = await this.productRepository.save(updateProduct);
    await this.productSearchService.indexProduct(saved);
    return ProductResponseDto.from(saved);
  }

  async remove(id: string): Promise<void> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException('존재하지 않는 상품입니다');
    }
    await this.productRepository.remove(product);
    await this.productSearchService.deleteProduct(id);
  }

  async search(
    keyword?: string,
    limit?: number,
  ): Promise<import('./dto/search-product.dto').SearchProductResponseDto[]> {
    if (!keyword || keyword.trim() === '') {
      return [];
    }
    return await this.productSearchService.searchProducts(
      keyword.trim(),
      limit,
    );
  }

  async syncSearch(): Promise<{ indexed: number }> {
    const indexed = await this.productSearchService.syncAllProducts();
    return { indexed };
  }
}
