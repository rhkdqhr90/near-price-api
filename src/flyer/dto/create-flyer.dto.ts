import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class FlyerProductBadgeDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsString()
  @IsNotEmpty()
  type: 'red' | 'yellow' | 'blue';
}

export class FlyerProductItemDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  emoji: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  imageUrl?: string | null;

  @IsNumber()
  @IsOptional()
  originalPrice?: number | null;

  @IsNumber()
  salePrice: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlyerProductBadgeDto)
  badges: FlyerProductBadgeDto[];
}

export class FlyerReviewItemDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  initial: string;

  @IsString()
  @IsNotEmpty()
  meta: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  content: string;

  @IsNumber()
  @IsOptional()
  helpfulCount?: number;

  @IsString()
  @IsNotEmpty()
  avatarColor: string;
}

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
  @IsIn(['classic', 'retro', 'news', 'coupon'])
  templateType?: 'classic' | 'retro' | 'news' | 'coupon';

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
  @ValidateNested({ each: true })
  @Type(() => FlyerProductItemDto)
  products?: FlyerProductItemDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FlyerReviewItemDto)
  reviews?: FlyerReviewItemDto[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
