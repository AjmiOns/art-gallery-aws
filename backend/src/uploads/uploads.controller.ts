import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';
import { memoryStorage } from 'multer';
import { join } from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../common/roles';
import { S3Storage } from './s3.storage';
import { UPLOAD_DIR } from './uploads.constants';

const EXT: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('artist', 'admin')
@Controller('uploads')
export class UploadsController {
  constructor(
    private readonly config: ConfigService,
    private readonly s3: S3Storage,
  ) {}

  // multipart/form-data, champ "file" : JPG, PNG ou WebP, 5 Mo maximum.
  // Le fichier arrive en mémoire (5 Mo max), puis part vers S3 (AWS) ou vers le disque (local).
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) =>
        EXT[file.mimetype] ? cb(null, true) : cb(new BadRequestException('Formats acceptés : JPG, PNG ou WebP.'), false),
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier reçu.');
    const name = `${randomUUID()}${EXT[file.mimetype]}`;

    if (this.s3.bucket) {
      await this.s3.put(name, file.buffer, file.mimetype);
      // Lien relatif : il reste valable quand l'adresse du load balancer change.
      return { url: `/api/uploads/${name}` };
    }

    writeFileSync(join(UPLOAD_DIR, name), file.buffer);
    const base = this.config.get<string>('PUBLIC_API_URL') ?? `http://localhost:${this.config.get('PORT') ?? 3001}`;
    return { url: `${base}/uploads/${name}` };
  }
}
