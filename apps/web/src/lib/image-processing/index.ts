/**
 * Image Processing Abstraction
 * 
 * Provides platform-agnostic image processing capabilities.
 * Web: Uses HTML Canvas API
 * Mobile: Will use expo-gl or native image processing
 */

export { imageProcessor, createImageProcessor } from './factory';
export type {
  IImageProcessor,
  IImage,
  ICanvas,
  ICanvasContext,
} from './types';
export { WebImageProcessor, WebCanvas, WebImage } from './web-processor';

