import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ProductCategory, UnitType } from '../entities/product.entity';

export class CreateProductDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  name: string;

  @IsEnum(ProductCategory)
  category: ProductCategory;

  @IsEnum(UnitType)
  unitType: UnitType;
}
