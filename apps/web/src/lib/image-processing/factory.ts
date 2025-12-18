/**
 * Image Processor Factory
 * 
 * Creates platform-specific image processor instances.
 * Currently only web implementation exists, mobile will be added later.
 */

import { IImageProcessor } from './types';
import { WebImageProcessor } from './web-processor';
// import { NativeImageProcessor } from './native-processor'; // For mobile later

export function createImageProcessor(): IImageProcessor {
  // For now, always use web version
  // Later: if (Platform.OS === 'web') return new WebImageProcessor();
  return new WebImageProcessor();
}

// Singleton instance
export const imageProcessor = createImageProcessor();

