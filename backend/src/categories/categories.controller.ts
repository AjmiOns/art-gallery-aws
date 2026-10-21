import { Controller, Get } from '@nestjs/common';
import { CategoriesService } from './categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  // Public : sert l'affichage de la galerie
  @Get()
  list() {
    return this.categories.findActive();
  }
}
