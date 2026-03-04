import { IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { StoreType } from '../entities/store.entity';

export class CreateStoreDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsEnum(StoreType)
  type: StoreType;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsNotEmpty()
  @IsString()
  address: string;

  @IsNotEmpty()
  @IsString()
  kakaoPlaceId: string;
}
