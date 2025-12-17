import { IFileUtils } from './types';
import { WebFileUtils } from './web-file-utils';
// import { NativeFileUtils } from './native-file-utils'; // For mobile later

export function createFileUtils(): IFileUtils {
  // For now, always use web version
  // Later: if (Platform.OS === 'web') return new WebFileUtils();
  return new WebFileUtils();
}

// Singleton instance
export const fileUtils = createFileUtils();

