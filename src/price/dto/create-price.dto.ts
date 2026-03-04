import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreatePriceDto {
  @IsUUID()
  @IsNotEmpty()
  storeId: string;

  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsInt()
  @Min(0)
  price: number;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsNotEmpty()
  @IsString()
  imageUrl: string;

  @IsOptional()
  @Type(() => Date)
  saleStartDate?: string;

  @IsOptional()
  @Type(() => Date)
  saleEndDate?: string;

  @IsOptional()
  @IsString()
  condition?: string;
}
