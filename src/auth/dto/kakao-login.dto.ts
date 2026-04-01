import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class KakaoLoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  kakaoAccessToken: string;
}
