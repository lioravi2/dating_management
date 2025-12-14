import { IFaceDetectionProvider } from './types';
import { FaceApiProvider } from './providers/face-api-provider';

export type FaceDetectionProviderType = 'face-api' | 'opencv' | 'compreface' | 'custom';

/**
 * Factory to create face detection providers
 */
export function createFaceDetectionProvider(
  type: FaceDetectionProviderType = 'face-api'
): IFaceDetectionProvider {
  switch (type) {
    case 'face-api':
      return new FaceApiProvider();
    
    // Future providers can be added here:
    // case 'opencv':
    //   return new OpenCVProvider();
    // case 'compreface':
    //   return new CompreFaceProvider();
    
    default:
      throw new Error(`Unknown face detection provider: ${type}`);
  }
}

/**
 * Get provider from environment variable or default
 */
export function getFaceDetectionProvider(): IFaceDetectionProvider {
  const providerType = (process.env.NEXT_PUBLIC_FACE_DETECTION_PROVIDER || 
    'face-api') as FaceDetectionProviderType;
  
  return createFaceDetectionProvider(providerType);
}
