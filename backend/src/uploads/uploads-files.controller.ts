import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { S3Storage } from './s3.storage';

// Lecture publique des images stockées sur S3 : GET /api/uploads/<uuid>.<jpg|png|webp>
// (le bucket reste privé, c'est l'API qui sert les fichiers).
const NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

@Controller('uploads')
export class UploadsFilesController {
  constructor(private readonly s3: S3Storage) {}

  @Get(':name')
  async file(@Param('name') name: string, @Res() res: Response) {
    // Nom strict : aucune clé S3 arbitraire ne peut être demandée.
    if (!this.s3.bucket || !NAME.test(name)) throw new NotFoundException();
    const found = await this.s3.get(name);
    if (!found) throw new NotFoundException();
    res.set({ 'Content-Type': found.contentType, 'Cache-Control': 'public, max-age=31536000, immutable' });
    found.body.on('error', () => res.destroy());
    found.body.pipe(res);
  }
}
