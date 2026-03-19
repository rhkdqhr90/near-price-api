export class UserDto {
  id: string;
  email: string;
  nickname: string;
  trustScore: number;
}

export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}
