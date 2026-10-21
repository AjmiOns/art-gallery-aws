import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';
import { TONES } from './category.entity';

export class CreateCategoryDto {
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: 'slug : minuscules, chiffres et tirets uniquement (ex. art-urbain)' })
  @MaxLength(40)
  slug: string;

  @IsString() @MinLength(2) @MaxLength(60)
  label: string;

  @IsOptional() @IsString() @MaxLength(120)
  tagline?: string;

  @IsOptional() @IsIn(TONES)
  tone?: string;

  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(60)
  label?: string;

  @IsOptional() @IsString() @MaxLength(120)
  tagline?: string;

  @IsOptional() @IsIn(TONES)
  tone?: string;

  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
