import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Readable } from 'stream';

// Stockage des images dans le bucket S3 de données : s3://<S3_BUCKET>/artworks/uploads/<fichier>
// Actif uniquement si S3_BUCKET est défini (déploiement AWS). Sans cette variable (développement
// local), les images restent sur disque, voir uploads.controller.ts.
const PREFIX = 'artworks/uploads/';

@Injectable()
export class S3Storage {
  private client?: S3Client;

  constructor(private readonly config: ConfigService) {}

  get bucket(): string | undefined {
    return this.config.get<string>('S3_BUCKET') || undefined;
  }

  private s3(): S3Client {
    // Région et identifiants viennent du rôle de l'instance (aucune clé dans le code).
    this.client ??= new S3Client({ region: this.config.get<string>('AWS_REGION') ?? 'us-east-1' });
    return this.client;
  }

  async put(name: string, body: Buffer, contentType: string): Promise<void> {
    await this.s3().send(
      new PutObjectCommand({ Bucket: this.bucket, Key: PREFIX + name, Body: body, ContentType: contentType }),
    );
  }

  // Renvoie null si le fichier n'existe pas.
  async get(name: string): Promise<{ body: Readable; contentType: string } | null> {
    try {
      const out = await this.s3().send(new GetObjectCommand({ Bucket: this.bucket, Key: PREFIX + name }));
      if (!out.Body) return null;
      return { body: out.Body as Readable, contentType: out.ContentType ?? 'application/octet-stream' };
    } catch (e) {
      const err = e as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) return null;
      throw e;
    }
  }
}
