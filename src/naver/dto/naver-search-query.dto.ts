import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class NaverSearchQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  query: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  display?: number = 10;

  @IsOptional()
  @IsString()
  @IsIn(['random', 'comment'])
  sort?: string = 'random';
}
