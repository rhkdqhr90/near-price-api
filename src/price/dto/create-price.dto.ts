import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
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
import type {
  BundleType,
  CardDiscountType,
  PriceTagType,
} from '../entities/price.entity';

const PRICE_TAG_TYPES: PriceTagType[] = [
  'normal',
  'sale',
  'special',
  'closing',
  'bundle',
  'flat',
  'member',
  'cardPayment',
];
const BUNDLE_TYPES: BundleType[] = ['1+1', '2+1', '3+1'];
const CARD_DISCOUNT_TYPES: CardDiscountType[] = ['amount', 'percent'];

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

  // ───── 가격표(PriceTag) ──────────────────────────────
  @IsOptional()
  @IsIn(PRICE_TAG_TYPES)
  priceTagType?: PriceTagType;

  // sale / closing / cardPayment → originalPrice 필수
  @ValidateIf(
    (o: CreatePriceDto) =>
      o.priceTagType === 'sale' ||
      o.priceTagType === 'closing' ||
      o.priceTagType === 'cardPayment',
  )
  @IsInt()
  @Min(0)
  @Max(99_999_999)
  originalPrice?: number;

  // bundle → bundleType 필수
  @ValidateIf((o: CreatePriceDto) => o.priceTagType === 'bundle')
  @IsIn(BUNDLE_TYPES)
  bundleType?: BundleType;

  // bundle → bundleQty 필수
  @ValidateIf((o: CreatePriceDto) => o.priceTagType === 'bundle')
  @IsInt()
  @Min(2)
  @Max(10)
  bundleQty?: number;

  // flat → flatGroupName 필수
  @ValidateIf((o: CreatePriceDto) => o.priceTagType === 'flat')
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  flatGroupName?: string;

  // member → memberPrice 필수
  @ValidateIf((o: CreatePriceDto) => o.priceTagType === 'member')
  @IsInt()
  @Min(0)
  @Max(99_999_999)
  memberPrice?: number;

  // closing → endsAt 필수
  @ValidateIf((o: CreatePriceDto) => o.priceTagType === 'closing')
  @IsDate()
  @Type(() => Date)
  endsAt?: Date;

  // cardPayment → cardLabel 필수 (자유 텍스트)
  @ValidateIf((o: CreatePriceDto) => o.priceTagType === 'cardPayment')
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  cardLabel?: string;

  // cardPayment → cardDiscountType 필수
  @ValidateIf((o: CreatePriceDto) => o.priceTagType === 'cardPayment')
  @IsIn(CARD_DISCOUNT_TYPES)
  cardDiscountType?: CardDiscountType;

  // cardPayment → cardDiscountValue 필수
  @ValidateIf((o: CreatePriceDto) => o.priceTagType === 'cardPayment')
  @IsInt()
  @Min(0)
  @Max(99_999_999)
  cardDiscountValue?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cardConditionNote?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}
