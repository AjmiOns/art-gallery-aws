import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    if (await this.users.findByEmailWithPassword(email)) {
      throw new ConflictException('Cet e-mail est déjà utilisé.');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.users.create({ email, username: dto.username, passwordHash });
    return this.session(user.id, user.email, user.username);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmailWithPassword(dto.email.toLowerCase());
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('E-mail ou mot de passe incorrect.');
    }
    return this.session(user.id, user.email, user.username);
  }

  private session(id: string, email: string, username: string) {
    return {
      accessToken: this.jwt.sign({ sub: id, email }),
      user: { id, email, username },
    };
  }
}
