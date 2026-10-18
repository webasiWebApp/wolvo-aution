import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { forbidden } from '../common/errors/app-error';
import { UserRole } from '../users/user.entity';
import { AuthUser } from './auth-user';
import { ROLES_KEY } from './decorators/auth.decorators';

// Global guard; runs after JwtAuthGuard and enforces @Roles().
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (user && roles.includes(user.role)) return true;
    throw forbidden('FORBIDDEN_ROLE', 'Your role cannot perform this action.');
  }
}
