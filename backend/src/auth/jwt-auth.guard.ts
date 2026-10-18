import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Request } from 'express';
import { Repository } from 'typeorm';
import { AppError } from '../common/errors/app-error';
import { UserEntity } from '../users/user.entity';
import { AuthUser } from './auth-user';
import { IS_PUBLIC_KEY } from './decorators/auth.decorators';

const unauthorized = () => new AppError(HttpStatus.UNAUTHORIZED, 'UNAUTHORIZED', 'Sign in required.');

// Global guard. Every route needs a valid Bearer token unless marked @Public().
// The user is re-read on each request so role changes apply immediately.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (!token) {
      if (isPublic) return true;
      throw unauthorized();
    }

    const user = await this.resolve(token);
    if (!user) {
      // An invalid token on a public route is treated as anonymous.
      if (isPublic) return true;
      throw unauthorized();
    }
    request.user = user;
    return true;
  }

  private async resolve(token: string): Promise<AuthUser | null> {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      const user = await this.users.findOne({ where: { id: payload.sub } });
      if (!user) return null;
      return { id: user.id, role: user.role, emailVerified: user.emailVerifiedAt !== null };
    } catch {
      return null;
    }
  }
}
