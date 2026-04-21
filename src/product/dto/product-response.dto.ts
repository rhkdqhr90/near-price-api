import { Product, ProductCategory } from '../entities/product.entity';

export class ProductResponseDto {
  id: string;
  name: string;
  category: ProductCategory;
  createdAt: Date;
  updatedAt: Date;

  static from(product: Product): ProductResponseDto {
    const dto = new ProductResponseDto();
    dto.id = product.id;
    dto.name = product.name;
    dto.category = product.category;
    dto.createdAt = product.createdAt;
    dto.updatedAt = product.updatedAt;

    return dto;
  }
}
