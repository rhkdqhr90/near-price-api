import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateNicknameDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : String(value),
  )
  @IsString()
  @MinLength(2)
  @MaxLength(6)
  @Matches(/^[가-힣a-zA-Z0-9]{2,6}$/, {
    message: '닉네임은 한글, 영문, 숫자만 포함 가능하며 2~6자여야 합니다.',
  })
  nickname: string;
}
