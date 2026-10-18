import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { ARTWORK_TAGS } from '../artwork.entity';

export class QueryArtworksDto {
  @IsOptional()
  @IsIn(ARTWORK_TAGS)
  tag?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;

  @IsOptional()
  @IsString()
  q?: string;
}
