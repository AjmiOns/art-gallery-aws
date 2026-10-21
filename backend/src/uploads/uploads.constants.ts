import { mkdirSync } from 'fs';
import { join } from 'path';

// Stockage local des images envoyées. En production : S3 (voir la feuille de route).
export const UPLOAD_DIR = join(process.cwd(), 'uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });
