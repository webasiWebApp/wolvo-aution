import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { Repository } from 'typeorm';
import { AppError } from '../common/errors/app-error';
import { UserEntity } from '../users/user.entity';
import { LoginResponseDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
  ) {}

  async login(email: string, password: string): Promise<LoginResponseDto> {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email })
      .getOne();
    const valid = user ? await argon2.verify(user.passwordHash, password).catch(() => false) : false;
    if (!user || !valid) {
      // Same message whether the email or the password is wrong.
      throw new AppError(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }
    return { accessToken: await this.jwt.signAsync({ sub: user.id }), tokenType: 'Bearer' };
  }
}
