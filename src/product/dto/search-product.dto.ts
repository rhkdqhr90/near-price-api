import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DEFAULT_PAGINATION_LIMIT } from '../../common/constants/pagination.constants';

export class SearchProductQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  limit?: number = DEFAULT_PAGINATION_LIMIT;
}

export class SearchProductResponseDto {
  id: string;
  name: string;
  score: number;
  highlight: string[];
}
