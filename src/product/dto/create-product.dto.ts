import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ProductCategory, UnitType } from '../entities/product.entity';

export class CreateProductDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsEnum(ProductCategory)
  category: ProductCategory;

  @IsEnum(UnitType)
  unitType: UnitType;
}
