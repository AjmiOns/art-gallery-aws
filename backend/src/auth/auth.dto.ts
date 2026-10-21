import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  username: string;

  @IsString()
  @MinLength(8)
  password: string;

  // Un compte administrateur ne peut pas être créé depuis l'inscription publique.
  @IsOptional()
  @IsIn(['artist', 'buyer'])
  role?: 'artist' | 'buyer';
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
