---
name: Face Quality Validation Improvements
overview: Create a shared face quality validation module and implement comprehensive quality checks (pixel size, face area percentage, relative size, aspect ratio, landmark coverage) to fix false positives and improve face detection quality. Ensure code reuse between mobile (API) and web (client-side) implementations.
todos:
  - id: create-shared-validation
    content: Create shared face quality validation module in packages/shared/face-quality.ts with types, metrics calculation, and validation functions
    status: completed
  - id: export-shared-module
    content: Export face quality module from packages/shared/index.ts
    status: completed
    dependencies:
      - create-shared-validation
  - id: update-web-provider
    content: Update apps/web/src/lib/face-detection/providers/face-api-provider.ts to use shared validation in detectFace() and detectAllFaces() methods
    status: completed
    dependencies:
      - export-shared-module
  - id: update-api-route
    content: Update apps/web/src/app/api/face-detection/detect/route.ts to use shared validation, replacing inline filtering logic
    status: completed
    dependencies:
      - export-shared-module
  - id: test-validation
    content: Test with Issue 2 test case (3 faces, should not detect bottom half) and magnified low-quality faces
    status: completed
    dependencies:
      - update-web-provider
      - update-api-route
---

# Face Quality Validation Improvements

## Overview

This plan addresses two issues:

1. **False positive detection** - Bottom half of faces being detected as valid (from ISSUE_2_FACE_DETECTION_SUMMARY.md)
2. **Insufficient quality checks** - Pixel size alone is not enough; magnified low-quality faces can pass validation

## Solution Architecture

Create a shared face quality validation module in `packages/shared` that can be used by both:

- Web app (client-side): `apps/web/src/lib/face-detection/providers/face-api-provider.ts`
- Mobile app (via API): `apps/web/src/app/api/face-detection/detect/route.ts`

**Critical**: Both implementations must use **original image dimensions** (before any resizing for detection) for validation calculations. This ensures consistent behavior:

- **Web**: Uses `naturalWidth/naturalHeight` from original image
- **Mobile/API**: Receives image resized to 3000px max, but API scales coordinates back to original dimensions before validation
- **Both**: Validation uses the same coordinate space (original image dimensions)

## Implementation Steps

### 1. Create Shared Face Quality Validation Module

**File**: `packages/shared/face-quality.ts`Create a pure TypeScript module (no dependencies) that provides:

```typescript
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
```

**Functions**:

- `calculateFaceQualityMetrics(boundingBox, imageDimensions, landmarks?, confidence)` - Calculate all quality metrics from face detection data
- `validateFaceQuality(metrics, config?)` - Validate face metrics against thresholds, returns `FaceQualityResult` with validation status and reasons
- `getDefaultConfig()` - Return default configuration values
- `validateFaceDetection(boundingBox, imageDimensions, landmarks?, confidence, config?)` - Convenience function that combines calculation and validation

**Important**: All functions use original image dimensions (not resized detection dimensions). The bounding box coordinates should already be scaled to original image space.

### 2. Update Shared Package Exports

**File**: `packages/shared/index.ts`Export the new face quality validation types and functions:

```typescript
export * from './face-quality';
```

### 3. Update Web App Face Detection Provider

**File**: `apps/web/src/lib/face-detection/providers/face-api-provider.ts`**Changes**:

- Import face quality validation from `@dating-app/shared`
- Replace inline validation logic with shared `validateFaceDetection()` function
- Use shared config constants (via `getDefaultConfig()`)
- Apply validation in both `detectFace()` and `detectAllFaces()` methods
- Extract landmark positions from face-api.js detection results (`detection.landmarks.positions`)
- **Critical**: Use `originalWidth/originalHeight` (not resized dimensions) for validation
- Scale bounding boxes to original dimensions before validation (already done, but ensure consistency)

**Key locations**:

- Line 182-191: Replace size validation in `detectFace()` with `validateFaceDetection()`
- Line 328-335: Replace size validation in `detectAllFaces()` with `validateFaceDetection()`
- Both methods already scale coordinates to original dimensions, so validation will work correctly

### 4. Update API Route Face Detection

**File**: `apps/web/src/app/api/face-detection/detect/route.ts`**Changes**:

- Import face quality validation from `@dating-app/shared`
- Replace inline filtering logic (lines 214-238) with shared `validateFaceDetection()` function
- Apply all quality checks: pixel size, area percentage, relative size, aspect ratio, landmark coverage
- Extract landmark positions from face-api.js detection results (`detection.landmarks.positions`)
- **Critical**: Use `originalWidth/originalHeight` (lines 150-151) for validation, not `inputCanvas` dimensions
- Scale bounding boxes to original dimensions before validation (already done at lines 209-210)
- Update error messages to include specific reasons from `FaceQualityResult.reasons`
- Group filtered detections by reason for better diagnostics

**Key locations**:

- Line 214-238: Replace size filter with `validateFaceDetection()` call
- Use `originalWidth/originalHeight` for image dimensions parameter
- Extract landmarks from `detection.landmarks.positions` if available
- Update error response to include validation reasons

### 5. Update Type Definitions (if needed)

**File**: `apps/web/src/lib/face-detection/types.ts`Ensure types are compatible with shared validation module. May need to add optional landmark data to `FaceDetectionResult` if not already present.

## Quality Checks Implementation

### Check 1: Absolute Pixel Size

- **Threshold**: 120px minimum dimension
- **Purpose**: Basic size requirement
- **Location**: Already implemented, move to shared module

### Check 2: Face Area Percentage

- **Threshold**: Face must be at least 2% of total image area
- **Purpose**: Catch magnified low-quality faces in large images
- **Calculation**: `(faceWidth * faceHeight) / (imageWidth * imageHeight) * 100`

### Check 3: Relative Size

- **Threshold**: Face must be at least 5% of smaller image dimension
- **Purpose**: Ensure face is proportionally significant in the image
- **Calculation**: `min(faceWidth, faceHeight) / min(imageWidth, imageHeight) * 100`

### Check 4: Aspect Ratio

- **Threshold**: width/height between 0.6 and 1.8
- **Purpose**: Filter out partial faces (bottom halves, side profiles, etc.)
- **Calculation**: `faceWidth / faceHeight`
- **Note**: Addresses ISSUE_2 false positive detection

### Check 5: Landmark Coverage

- **Threshold**: Landmarks should cover at least 50% of face bounding box
- **Purpose**: Ensure key facial features are detected and well-distributed
- **Calculation**: 
- Get landmark X/Y ranges
- Calculate coverage: `min(xRange/faceWidth, yRange/faceHeight)`
- **Note**: Only applies if landmarks are available

### Check 6: Confidence Score

- **Threshold**: 0.65 (65%)
- **Purpose**: Filter out low-confidence detections (animals, false positives)
- **Location**: Already implemented, move to shared module

## Code Reuse Benefits

1. **Single source of truth** - All validation logic in one place (`packages/shared/face-quality.ts`)
2. **Consistent behavior** - Web (client-side) and mobile (via API) use identical validation logic
3. **Easy maintenance** - Update thresholds in one location, affects both platforms
4. **Testability** - Pure functions easy to unit test
5. **Type safety** - Shared TypeScript types ensure consistency between platforms
6. **No duplication** - Validation logic not repeated in web provider and API route

## Image Dimension Handling

**Critical for consistency**: Both implementations must use original image dimensions:

- **Web app flow**:

  1. Original image loaded (e.g., 4000x3000)
  2. Resized to 600px max for detection (if needed)
  3. Face detection returns coordinates in resized space
  4. Coordinates scaled back to original dimensions (lines 167-168, 325-326)
  5. **Validation uses original dimensions** (4000x3000)

- **Mobile/API flow**:

  1. Mobile resizes original image to 3000px max (`prepareImageForFaceDetection`)
  2. Sends resized image to API
  3. API resizes to 600px max for detection (if needed)
  4. Face detection returns coordinates in 600px space
  5. Coordinates scaled back to 3000px space (lines 209-210)
  6. **Validation uses 3000px dimensions** (the "original" from API's perspective)

Both flows ensure validation uses the same coordinate space as the final bounding boxes, ensuring consistent behavior.

## Testing Considerations

After implementation, test with:

1. **Issue 2 test case**: Photo with 3 faces (should not detect bottom half as 4th face)
2. **Magnified face**: Low-quality face upscaled to 120px+ (should be rejected)
3. **Valid faces**: Normal photos should still pass all checks
4. **Edge cases**: Very small faces, extreme aspect ratios, partial faces

## Files to Modify

1. `packages/shared/face-quality.ts` - **NEW** - Shared validation module
2. `packages/shared/index.ts` - Export new module
3. `apps/web/src/lib/face-detection/providers/face-api-provider.ts` - Use shared validation
4. `apps/web/src/app/api/face-detection/detect/route.ts` - Use shared validation

## Configuration

All thresholds will be configurable via `FaceQualityConfig` interface. Default values:

- `minPixelSize: 120`
- `minFaceAreaPercentage: 2.0`
- `minRelativeSize: 5.0`
- `minAspectRatio: 0.6`
- `maxAspectRatio: 1.8`
- `minLandmarkCoverage: 0.5`
- `minConfidence: 0.65`

## Implementation Notes

1. **Landmark extraction**: face-api.js provides landmarks via `detection.landmarks.positions` (array of `{x, y}`). Extract this before validation.

2. **Error messages**: The `FaceQualityResult.reasons` array provides specific reasons for rejection. Use these to create user-friendly error messages.

3. **Backward compatibility**: The validation module should be a drop-in replacement for existing size/confidence checks. Existing error handling flows should continue to work.

4. **Performance**: Validation is pure TypeScript with no dependencies, so it's fast and can run on both client and server without issues.