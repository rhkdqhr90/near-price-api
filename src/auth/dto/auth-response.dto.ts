export class UserDto {
  id: string;
  email: string;
  nickname: string;
  trustScore: number;
  profileImageUrl: string | null;
}

export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}
