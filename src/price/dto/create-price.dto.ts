import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsSaleEndDateAfterStart } from './validators/sale-date.validator';

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
  @Matches(/^https?:\/\//, { message: 'imageUrl must be a valid HTTP(S) URL' })
  imageUrl: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  saleStartDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  @ValidateIf((o: CreatePriceDto) => o.saleStartDate !== undefined)
  @IsSaleEndDateAfterStart()
  saleEndDate?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  condition?: string;
}
