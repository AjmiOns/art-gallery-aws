import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60)
  username?: string;

  @IsOptional() @IsString() @MaxLength(32)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(80)
  city?: string;

  @IsOptional() @IsString() @MaxLength(500)
  bio?: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString() @MinLength(8) @MaxLength(100)
  newPassword: string;
}

export class AdminUpdateUserDto extends UpdateProfileDto {
  @IsOptional() @IsIn(['admin', 'artist', 'buyer'])
  role?: 'admin' | 'artist' | 'buyer';

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
