import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class NaverGeocodeQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  query: string;
}
