import { IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { StoreType } from '../entities/store.entity';

export class NearbyStoreQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(10000)
  radius: number = 3000;
}

export class NearbyStoreResponseDto {
  id: string;
  name: string;
  type: StoreType;
  latitude: number;
  longitude: number;
  address: string;
  distance: number;
}
