import { IFileUtils } from './types';

export class WebFileUtils implements IFileUtils {
  async fileToBase64(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.readAsDataURL(file);
    });
  }

  async fileToBlob(file: File | Blob): Promise<Blob> {
    if (file instanceof Blob && !(file instanceof File)) {
      return file;
    }
    // At this point, file is either a File or a Blob that's also a File
    // File extends Blob, so we need to check for File specifically
    if (file instanceof File) {
      return new Blob([file], { type: file.type });
    }
    // Fallback for Blob (shouldn't happen due to first check, but TypeScript needs it)
    return file;
  }

  getFileSize(file: File | Blob): number {
    return file.size;
  }

  getFileType(file: File | Blob): string {
    if (file instanceof File) {
      return file.type;
    }
    return 'application/octet-stream';
  }
}

