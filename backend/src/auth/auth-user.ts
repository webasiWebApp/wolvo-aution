import { UserRole } from '../users/user.entity';

// The signed-in user attached to each authenticated request.
export interface AuthUser {
  id: string;
  role: UserRole;
  emailVerified: boolean;
}

export const isAdmin = (user: AuthUser | null | undefined): boolean => user?.role === 'admin';
