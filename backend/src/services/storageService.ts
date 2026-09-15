import fs from 'fs';
import path from 'path';

// Upload directory (backend/uploads)
export const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

// Ensure directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Storage Service Interface
 * Allows seamless swapping between Local Disk, AWS S3, or Firebase Storage
 */
export interface IFileStorageService {
  getFilePath(fileIdentifier: string): string;
  fileExists(fileIdentifier: string): boolean;
  deleteFile(fileIdentifier: string): Promise<void>;
}

export class LocalStorageService implements IFileStorageService {
  getFilePath(fileIdentifier: string): string {
    const filename = path.basename(fileIdentifier);
    return path.join(UPLOADS_DIR, filename);
  }

  fileExists(fileIdentifier: string): boolean {
    const filePath = this.getFilePath(fileIdentifier);
    return fs.existsSync(filePath);
  }

  async deleteFile(fileIdentifier: string): Promise<void> {
    const filePath = this.getFilePath(fileIdentifier);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }
}

export const storageService: IFileStorageService = new LocalStorageService();
