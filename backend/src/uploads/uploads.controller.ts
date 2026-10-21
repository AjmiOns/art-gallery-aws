import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../common/roles';
import { UPLOAD_DIR } from './uploads.constants';

const EXT: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('artist', 'admin')
@Controller('uploads')
export class UploadsController {
  constructor(private readonly config: ConfigService) {}

  // multipart/form-data, champ "file" : JPG, PNG ou WebP, 5 Mo maximum
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${EXT[file.mimetype] ?? ''}`),
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) =>
        EXT[file.mimetype] ? cb(null, true) : cb(new BadRequestException('Formats acceptés : JPG, PNG ou WebP.'), false),
    }),
  )
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier reçu.');
    const base = this.config.get<string>('PUBLIC_API_URL') ?? `http://localhost:${this.config.get('PORT') ?? 3001}`;
    return { url: `${base}/uploads/${file.filename}` };
  }
}
