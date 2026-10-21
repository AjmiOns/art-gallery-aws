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
    const user = await this.users.create({ email, username: dto.username, passwordHash, role: dto.role ?? 'buyer' });
    return this.session(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmailWithPassword(dto.email.toLowerCase());
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('E-mail ou mot de passe incorrect.');
    }
    if (!user.isActive) throw new UnauthorizedException('Ce compte est suspendu. Contactez un administrateur.');
    return this.session(user);
  }

  private session(user: { id: string; email: string; username: string; role: string }) {
    return {
      accessToken: this.jwt.sign({ sub: user.id, email: user.email }),
      user: { id: user.id, email: user.email, username: user.username, role: user.role },
    };
  }
}
