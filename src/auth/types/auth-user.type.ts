import { UserRole } from '../../user/entities/user.entity';

export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
}
