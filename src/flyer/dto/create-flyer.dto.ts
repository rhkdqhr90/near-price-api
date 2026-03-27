import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import type {
  FlyerProductItem,
  FlyerReviewItem,
} from '../entities/flyer.entity';

export class CreateFlyerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  storeName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  promotionTitle: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  badge: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  badgeColor: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  dateRange: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  highlight: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  bgColor?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  emoji?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  warningText?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  ownerQuote?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  ownerName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  ownerRole?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  storeAddress?: string;

  @IsNumber()
  @IsOptional()
  storeRating?: number;

  @IsNumber()
  @IsOptional()
  storeReviewCount?: number;

  @IsArray()
  @IsOptional()
  products?: FlyerProductItem[];

  @IsArray()
  @IsOptional()
  reviews?: FlyerReviewItem[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
