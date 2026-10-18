import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/user.entity';
import { AuthUser } from '../auth-user';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

// No sign-in required. A valid token, if sent, still identifies the caller.
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// Only these roles may call the route (checked by RolesGuard).
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// The signed-in user, or null on a public route called anonymously.
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | null =>
    ctx.switchToHttp().getRequest<{ user?: AuthUser }>().user ?? null,
);
