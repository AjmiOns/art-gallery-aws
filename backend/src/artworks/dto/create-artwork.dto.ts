import { ArrayMinSize, IsArray, IsNotEmpty, IsNumber, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CreateArtworkDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  title: string;

  // Lien http(s) ou chemin du site (ex. /artworks/painting/painting-01.jpg)
  @Matches(/^(https?:\/\/\S+|\/\S+)$/, { message: 'imageUrl doit être un lien http(s) ou un chemin commençant par /' })
  imageUrl: string;

  // Slugs de catégories ; le premier est la catégorie principale.
  @IsArray() @ArrayMinSize(1) @IsString({ each: true })
  tags: string[];

  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  price: number;
}
