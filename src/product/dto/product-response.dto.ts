import { Product, ProductCategory, UnitType } from '../entities/product.entity';

export class ProductResponseDto {
  id: string;
  name: string;
  unitType: UnitType;
  category: ProductCategory;
  createdAt: Date;
  updatedAt: Date;

  static from(product: Product): ProductResponseDto {
    const dto = new ProductResponseDto();
    dto.id = product.id;
    dto.name = product.name;
    dto.unitType = product.unitType;
    dto.category = product.category;
    dto.createdAt = product.createdAt;
    dto.updatedAt = product.updatedAt;

    return dto;
  }
}
