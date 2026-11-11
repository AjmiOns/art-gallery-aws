import { Module } from '@nestjs/common';
import { S3Storage } from './s3.storage';
import { UploadsController } from './uploads.controller';
import { UploadsFilesController } from './uploads-files.controller';

@Module({ controllers: [UploadsController, UploadsFilesController], providers: [S3Storage] })
export class UploadsModule {}
