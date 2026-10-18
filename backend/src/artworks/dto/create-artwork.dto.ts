import { IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';
import { ARTWORK_TAGS } from '../artwork.entity';

export class CreateArtworkDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  // Lien http(s) ou chemin du site (ex. /artworks/painting/painting-01.jpg)
  @Matches(/^(https?:\/\/\S+|\/\S+)$/, { message: 'imageUrl doit être un lien http(s) ou un chemin commençant par /' })
  imageUrl: string;

  @IsOptional()
  @IsArray()
  @IsIn(ARTWORK_TAGS, { each: true })
  tags?: string[];

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;
}
