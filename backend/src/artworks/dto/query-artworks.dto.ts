import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class QueryArtworksDto {
  @IsOptional() @IsString()
  tag?: string;

  @IsOptional() @Type(() => Number) @IsNumber()
  maxPrice?: number;

  @IsOptional() @IsString()
  q?: string;

  @IsOptional() @IsIn(['available', 'reserved', 'sold'])
  status?: string;
}
