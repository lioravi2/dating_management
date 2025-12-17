export interface IFileUtils {
  fileToBase64(file: File | Blob): Promise<string>;
  fileToBlob(file: File | Blob): Promise<Blob>;
  getFileSize(file: File | Blob): number;
  getFileType(file: File | Blob): string;
}

