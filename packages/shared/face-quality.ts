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
  aspectRatio: number;             // width/height ratio
  landmarkCoverage?: number;      // How well landmarks cover face (0-1)
  confidence: number;              // Detection confidence (0-1)
}

export interface FaceQualityConfig {
  minPixelSize: number;            // Default: 120
  minFaceAreaPercentage: number;   // Default: 2.0
  minRelativeSize: number;         // Default: 5.0
  minAspectRatio: number;           // Default: 0.6
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
 * Get default face quality configuration
 */
export function getDefaultConfig(): FaceQualityConfig {
  return {
    minPixelSize: 120,
    minFaceAreaPercentage: 2.0,
    minRelativeSize: 5.0,
    minAspectRatio: 0.75, // Tightened further to catch partial faces (narrow faces)
    maxAspectRatio: 1.4, // Tightened further to catch partial faces (bottom halves are typically > 1.4)
    minLandmarkCoverage: 0.5,
    minConfidence: 0.65,
  };
}

/**
 * Calculate landmark coverage - how well landmarks cover the face bounding box
 * Returns a value between 0 and 1, where 1 means landmarks cover the entire face
 * Also checks for landmarks being skewed to one side (indicating partial face)
 */
function calculateLandmarkCoverage(
  boundingBox: FaceBoundingBox,
  landmarks: LandmarkPosition[]
): number {
  if (!landmarks || landmarks.length === 0) {
    // If no landmarks, we can't verify coverage - be more conservative
    // Check aspect ratio as fallback - if aspect ratio is suspicious, assume low coverage
    const aspectRatio = boundingBox.width / boundingBox.height;
    // If aspect ratio suggests partial face (very wide or very narrow), assume low coverage
    // This helps catch partial faces when landmarks aren't available
    if (aspectRatio > 1.3 || aspectRatio < 0.8) {
      return 0.4; // Return low coverage to trigger validation failure
    }
    return 1.0; // Otherwise assume full coverage
  }

  // Find the range of landmark positions
  const xValues = landmarks.map(l => l.x);
  const yValues = landmarks.map(l => l.y);
  
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  
  const xRange = maxX - minX;
  const yRange = maxY - minY;
  
  // Calculate coverage as the minimum of width/height coverage ratios
  // This ensures both dimensions are well-covered
  const widthCoverage = xRange / boundingBox.width;
  const heightCoverage = yRange / boundingBox.height;
  
  // Check if landmarks are skewed to one side (indicating partial face)
  // For a full face, landmarks should be relatively centered in the bounding box
  const centerX = boundingBox.x + boundingBox.width / 2;
  const centerY = boundingBox.y + boundingBox.height / 2;
  const landmarkCenterX = (minX + maxX) / 2;
  const landmarkCenterY = (minY + maxY) / 2;
  
  // Calculate how far landmark center is from bounding box center (normalized)
  const xOffset = Math.abs(landmarkCenterX - centerX) / boundingBox.width;
  const yOffset = Math.abs(landmarkCenterY - centerY) / boundingBox.height;
  
  // If landmarks are heavily skewed (>30% offset), reduce coverage
  // This catches cases like bottom half of face where landmarks are in bottom portion
  const skewPenalty = Math.max(0, 1 - Math.max(xOffset, yOffset) * 2); // Penalize if offset > 0.5
  
  const baseCoverage = Math.min(widthCoverage, heightCoverage);
  
  // Apply skew penalty - if landmarks are skewed, reduce coverage
  return baseCoverage * (0.7 + 0.3 * skewPenalty); // Minimum 70% of base coverage if heavily skewed
}

/**
 * Calculate all face quality metrics from face detection data
 * All coordinates should be in original image space (not resized)
 */
export function calculateFaceQualityMetrics(
  boundingBox: FaceBoundingBox,
  imageDimensions: ImageDimensions,
  landmarks?: LandmarkPosition[],
  confidence?: number
): FaceQualityMetrics {
  const faceWidth = boundingBox.width;
  const faceHeight = boundingBox.height;
  const imageWidth = imageDimensions.width;
  const imageHeight = imageDimensions.height;
  
  // Minimum dimension in pixels
  const pixelSize = Math.min(faceWidth, faceHeight);
  
  // Face area as percentage of total image area
  const faceArea = faceWidth * faceHeight;
  const imageArea = imageWidth * imageHeight;
  const faceAreaPercentage = (faceArea / imageArea) * 100;
  
  // Face size as percentage of smaller image dimension
  const minImageDimension = Math.min(imageWidth, imageHeight);
  const minFaceDimension = Math.min(faceWidth, faceHeight);
  const relativeSize = (minFaceDimension / minImageDimension) * 100;
  
  // Aspect ratio (width/height)
  const aspectRatio = faceWidth / faceHeight;
  
  // Landmark coverage (if landmarks provided)
  const landmarkCoverage = landmarks 
    ? calculateLandmarkCoverage(boundingBox, landmarks)
    : undefined;
  
  return {
    pixelSize,
    faceAreaPercentage,
    relativeSize,
    aspectRatio,
    landmarkCoverage,
    confidence: confidence ?? 0,
  };
}

/**
 * Validate face metrics against thresholds
 * Returns validation result with reasons for rejection (if any)
 */
export function validateFaceQuality(
  metrics: FaceQualityMetrics,
  config?: FaceQualityConfig
): FaceQualityResult {
  const cfg = config ?? getDefaultConfig();
  const reasons: string[] = [];
  
  // Check 1: Absolute pixel size
  if (metrics.pixelSize < cfg.minPixelSize) {
    reasons.push(
      `Face too small (${Math.round(metrics.pixelSize)}px). Minimum ${cfg.minPixelSize}px required.`
    );
  }
  
  // Check 2: Face area percentage
  if (metrics.faceAreaPercentage < cfg.minFaceAreaPercentage) {
    reasons.push(
      `Face area too small (${metrics.faceAreaPercentage.toFixed(2)}% of image). Minimum ${cfg.minFaceAreaPercentage}% required.`
    );
  }
  
  // Check 3: Relative size
  if (metrics.relativeSize < cfg.minRelativeSize) {
    reasons.push(
      `Face too small relative to image (${metrics.relativeSize.toFixed(2)}% of smaller dimension). Minimum ${cfg.minRelativeSize}% required.`
    );
  }
  
  // Check 4: Aspect ratio
  if (metrics.aspectRatio < cfg.minAspectRatio) {
    reasons.push(
      `Face aspect ratio too narrow (${metrics.aspectRatio.toFixed(2)}). Minimum ${cfg.minAspectRatio} required. This may be a partial face.`
    );
  }
  if (metrics.aspectRatio > cfg.maxAspectRatio) {
    reasons.push(
      `Face aspect ratio too wide (${metrics.aspectRatio.toFixed(2)}). Maximum ${cfg.maxAspectRatio} required. This may be a partial face.`
    );
  }
  
  // Check 5: Landmark coverage (only if landmarks provided)
  if (metrics.landmarkCoverage !== undefined && metrics.landmarkCoverage < cfg.minLandmarkCoverage) {
    reasons.push(
      `Landmark coverage insufficient (${(metrics.landmarkCoverage * 100).toFixed(1)}%). Minimum ${(cfg.minLandmarkCoverage * 100).toFixed(0)}% required.`
    );
  }
  
  // Check 6: Confidence score
  if (metrics.confidence < cfg.minConfidence) {
    reasons.push(
      `Face confidence too low (${(metrics.confidence * 100).toFixed(0)}%). Minimum ${(cfg.minConfidence * 100).toFixed(0)}% required.`
    );
  }
  
  return {
    isValid: reasons.length === 0,
    metrics,
    reasons,
  };
}

/**
 * Convenience function that combines calculation and validation
 * All coordinates should be in original image space (not resized)
 */
export function validateFaceDetection(
  boundingBox: FaceBoundingBox,
  imageDimensions: ImageDimensions,
  landmarks?: LandmarkPosition[],
  confidence?: number,
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

