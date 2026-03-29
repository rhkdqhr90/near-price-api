import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateInquiryDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/\S/, { message: '공백만 입력할 수 없습니다.' })
  title: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  @Matches(/\S/, { message: '공백만 입력할 수 없습니다.' })
  content: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;
}
