import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
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
  @Max(99_999_999)
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsNotEmpty()
  @IsString()
  imageUrl: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  saleStartDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  saleEndDate?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  condition?: string;
}
