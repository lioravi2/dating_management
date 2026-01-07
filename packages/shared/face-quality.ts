// Types for face quality validation

export interface FaceBoundingBox {
  width: number;
  height: number;
  x: number;
  y: number;
}

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface LandmarkPosition {
  x: number;
  y: number;
}

export interface FaceQualityMetrics {
  pixelSize: number;              // Minimum dimension in pixels
  faceAreaPercentage: number;     // Face area as % of image area
  relativeSize: number;           // Face size as % of smaller image dimension
  aspectRatio: number;            // width/height ratio
  landmarkCoverage?: number;      // How well landmarks cover face (0-1)
  confidence: number;             // Detection confidence (0-1)
}

export interface FaceQualityConfig {
  minPixelSize: number;            // Default: 120
  minFaceAreaPercentage: number;   // Default: 2.0
  minRelativeSize: number;         // Default: 5.0
  minAspectRatio: number;          // Default: 0.6
  maxAspectRatio: number;          // Default: 1.8
  minLandmarkCoverage: number;     // Default: 0.5
  minConfidence: number;           // Default: 0.65
}

export interface FaceQualityResult {
  isValid: boolean;
  metrics: FaceQualityMetrics;
  reasons: string[];  // Reasons why face is invalid (if any)
}

/**
 * Default configuration for face quality validation
 */
export function getDefaultConfig(): FaceQualityConfig {
  return {
    minPixelSize: 120,
    minFaceAreaPercentage: 2.0,
    minRelativeSize: 5.0,
    minAspectRatio: 0.6,
    maxAspectRatio: 1.8,
    minLandmarkCoverage: 0.5,
    minConfidence: 0.65,
  };
}

/**
 * Calculate all quality metrics from face detection data
 * 
 * @param boundingBox - Face bounding box in original image coordinates
 * @param imageDimensions - Original image dimensions (not resized)
 * @param landmarks - Optional landmark positions (scaled to original dimensions)
 * @param confidence - Detection confidence score (0-1)
 */
export function calculateFaceQualityMetrics(
  boundingBox: FaceBoundingBox,
  imageDimensions: ImageDimensions,
  landmarks?: LandmarkPosition[],
  confidence: number = 1.0
): FaceQualityMetrics {
  const { width: faceWidth, height: faceHeight } = boundingBox;
  const { width: imageWidth, height: imageHeight } = imageDimensions;

  // Minimum dimension in pixels (smaller of width/height)
  const pixelSize = Math.min(faceWidth, faceHeight);

  // Face area as percentage of total image area
  const faceArea = faceWidth * faceHeight;
  const imageArea = imageWidth * imageHeight;
  const faceAreaPercentage = (faceArea / imageArea) * 100;

  // Face size as percentage of smaller image dimension
  const smallerDimension = Math.min(imageWidth, imageHeight);
  const relativeSize = (pixelSize / smallerDimension) * 100;

  // Aspect ratio (width/height)
  const aspectRatio = faceWidth / faceHeight;

  // Calculate landmark coverage if landmarks are provided
  let landmarkCoverage: number | undefined = undefined;
  if (landmarks && landmarks.length > 0) {
    // Calculate bounding box of landmarks
    const landmarkX = landmarks.map(l => l.x);
    const landmarkY = landmarks.map(l => l.y);
    const minX = Math.min(...landmarkX);
    const maxX = Math.max(...landmarkX);
    const minY = Math.min(...landmarkY);
    const maxY = Math.max(...landmarkY);
    
    const landmarkWidth = maxX - minX;
    const landmarkHeight = maxY - minY;
    const landmarkArea = landmarkWidth * landmarkHeight;
    
    // Coverage = landmark bounding box area / face bounding box area
    // Should be close to 1.0 if landmarks cover the face well
    landmarkCoverage = landmarkArea / faceArea;
  }

  return {
    pixelSize,
    faceAreaPercentage,
    relativeSize,
    aspectRatio,
    landmarkCoverage,
    confidence,
  };
}

/**
 * Validate face metrics against thresholds
 * 
 * @param metrics - Face quality metrics
 * @param config - Quality configuration (uses defaults if not provided)
 */
export function validateFaceQuality(
  metrics: FaceQualityMetrics,
  config?: FaceQualityConfig
): FaceQualityResult {
  const cfg = config || getDefaultConfig();
  const reasons: string[] = [];

  // Check minimum pixel size
  if (metrics.pixelSize < cfg.minPixelSize) {
    reasons.push(`Face too small (${Math.round(metrics.pixelSize)}px minimum dimension, need ${cfg.minPixelSize}px)`);
  }

  // Check face area percentage
  if (metrics.faceAreaPercentage < cfg.minFaceAreaPercentage) {
    reasons.push(`Face area too small (${metrics.faceAreaPercentage.toFixed(2)}% of image, need ${cfg.minFaceAreaPercentage}%)`);
  }

  // Check relative size
  if (metrics.relativeSize < cfg.minRelativeSize) {
    reasons.push(`Face too small relative to image (${metrics.relativeSize.toFixed(2)}% of smaller dimension, need ${cfg.minRelativeSize}%)`);
  }

  // Check aspect ratio
  if (metrics.aspectRatio < cfg.minAspectRatio || metrics.aspectRatio > cfg.maxAspectRatio) {
    reasons.push(`Face aspect ratio invalid (${metrics.aspectRatio.toFixed(2)}, must be between ${cfg.minAspectRatio} and ${cfg.maxAspectRatio})`);
  }

  // Check landmark coverage (if landmarks provided)
  if (metrics.landmarkCoverage !== undefined && metrics.landmarkCoverage < cfg.minLandmarkCoverage) {
    reasons.push(`Face landmarks coverage too low (${metrics.landmarkCoverage.toFixed(2)}, need ${cfg.minLandmarkCoverage})`);
  }

  // Check confidence
  if (metrics.confidence < cfg.minConfidence) {
    reasons.push(`Face detection confidence too low (${metrics.confidence.toFixed(2)}, need ${cfg.minConfidence})`);
  }

  return {
    isValid: reasons.length === 0,
    metrics,
    reasons,
  };
}

/**
 * Convenience function that combines calculation and validation
 * 
 * @param boundingBox - Face bounding box in original image coordinates
 * @param imageDimensions - Original image dimensions (not resized)
 * @param landmarks - Optional landmark positions (scaled to original dimensions)
 * @param confidence - Detection confidence score (0-1)
 * @param config - Quality configuration (uses defaults if not provided)
 */
export function validateFaceDetection(
  boundingBox: FaceBoundingBox,
  imageDimensions: ImageDimensions,
  landmarks?: LandmarkPosition[],
  confidence: number = 1.0,
  config?: FaceQualityConfig
): FaceQualityResult {
  const metrics = calculateFaceQualityMetrics(
    boundingBox,
    imageDimensions,
    landmarks,
    confidence
  );
  
  return validateFaceQuality(metrics, config);
}
