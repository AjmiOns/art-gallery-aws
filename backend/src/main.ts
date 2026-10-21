import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { UPLOAD_DIR } from './uploads/uploads.constants';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableCors({ origin: (process.env.FRONTEND_URL ?? 'http://localhost:3000').split(',') });
  // Images envoyées par les artistes : http://localhost:3001/uploads/<fichier>
  app.useStaticAssets(UPLOAD_DIR, { prefix: '/uploads' });
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
  console.log(`API prête sur http://localhost:${port}/api`);
}
bootstrap();
