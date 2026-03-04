import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from './entities/product.entity';
import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async create(
    createProductDto: CreateProductDto,
  ): Promise<ProductResponseDto> {
    const create = this.productRepository.create(createProductDto);
    const saved = await this.productRepository.save(create);
    return ProductResponseDto.from(saved);
  }

  async findAll(): Promise<ProductResponseDto[]> {
    const products = await this.productRepository.find();
    return products.map((product) => ProductResponseDto.from(product));
  }

  async findOne(id: string): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({ where: { id } });

    if (!product) {
      throw new NotFoundException(' 존재 하지 않는 상품 입니다');
    }

    return ProductResponseDto.from(product);
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    const product = await this.productRepository.findOne({ where: { id } });

    if (!product) {
      throw new NotFoundException(' 존재 하지 않는 상품 입니다');
    }
    const updateProduct = { ...product, ...updateProductDto };
    const saved = await this.productRepository.save(updateProduct);
    return ProductResponseDto.from(saved);
  }

  async remove(id: string): Promise<void> {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(' 존재 하지 않는 상품 입니다');
    }
    await this.productRepository.remove(product);
  }
}
