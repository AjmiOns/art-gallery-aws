import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Role } from '../users/user.entity';

export interface AuthUser {
  userId: string;
  email: string;
  role: Role;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
