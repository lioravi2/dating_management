/**
 * Face descriptor - 128-dimensional vector (or provider-specific format)
 */
export type FaceDescriptor = number[];

/**
 * Face detection result
 */
export interface FaceDetectionResult {
  descriptor: FaceDescriptor | null;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  confidence: number | null;
  error: string | null;
}

/**
 * Multiple face detection result
 */
export interface MultipleFaceDetectionResult {
  detections: FaceDetectionResult[];
  error: string | null;
}

/**
 * Face Detection Provider Interface
 * 
 * All face detection implementations must implement this interface
 */
export interface IFaceDetectionProvider {
  /**
   * Initialize/load models
   */
  initialize(): Promise<void>;
  
  /**
   * Check if models are loaded
   */
  isInitialized(): boolean;
  
  /**
   * Get loading state
   */
  isLoading(): boolean;
  
  /**
   * Get error state
   */
  getError(): string | null;
  
  /**
   * Detect a single face in an image
   */
  detectFace(
    image: HTMLImageElement | HTMLCanvasElement | ImageData
  ): Promise<FaceDetectionResult>;
  
  /**
   * Detect all faces in an image
   */
  detectAllFaces(
    image: HTMLImageElement | HTMLCanvasElement | ImageData
  ): Promise<MultipleFaceDetectionResult>;
  
  /**
   * Calculate similarity between two descriptors
   * Returns 0-1, where 1 is identical
   */
  calculateSimilarity(
    descriptor1: FaceDescriptor,
    descriptor2: FaceDescriptor
  ): number;
}
