import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateOwnerPostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  ownerName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  badge: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  emoji?: string;

  @IsNumber()
  @IsOptional()
  likeCount?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
