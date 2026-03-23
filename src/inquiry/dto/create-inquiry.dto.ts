import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateInquiryDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  title: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  content: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;
}
