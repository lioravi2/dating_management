import { PartnerPhoto, FaceMatch } from '@/shared';

/**
 * Calculate similarity between two face descriptors
 * 
 * Note: This is a generic implementation. For provider-specific optimizations,
 * use the provider's calculateSimilarity method directly.
 */
export function calculateFaceSimilarity(
  descriptor1: number[],
  descriptor2: number[]
): number {
  if (descriptor1.length !== descriptor2.length) {
    return 0;
  }

  // Calculate Euclidean distance
  let sumSquaredDiff = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    const diff = descriptor1[i] - descriptor2[i];
    sumSquaredDiff += diff * diff;
  }
  const distance = Math.sqrt(sumSquaredDiff);

  // Convert distance to similarity (0-1 scale)
  // Typical threshold: distance < 0.6 = match
  // We normalize: similarity = 1 - min(distance, 1)
  return Math.max(0, 1 - Math.min(distance, 1));
}

/**
 * Find matching faces from existing photos
 */
export function findFaceMatches(
  newDescriptor: number[],
  existingPhotos: PartnerPhoto[],
  threshold: number = 0.4 // Similarity threshold (0.4 = 0.6 distance)
): FaceMatch[] {
  const matches: FaceMatch[] = [];

  for (const photo of existingPhotos) {
    if (!photo.face_descriptor) continue;

    // Ensure face_descriptor is an array (it might be stored as JSONB)
    let descriptor: number[];
    if (Array.isArray(photo.face_descriptor)) {
      descriptor = photo.face_descriptor;
    } else if (typeof photo.face_descriptor === 'string') {
      try {
        descriptor = JSON.parse(photo.face_descriptor);
      } catch (e) {
        console.warn('Failed to parse face_descriptor:', e);
        continue;
      }
    } else {
      console.warn('Invalid face_descriptor type:', typeof photo.face_descriptor);
      continue;
    }

    const similarity = calculateFaceSimilarity(
      newDescriptor,
      descriptor
    );

    if (similarity >= threshold) {
      matches.push({
        photo_id: photo.id,
        partner_id: photo.partner_id,
        partner_name: null, // Will be populated by caller
        similarity,
        confidence: similarity * 100, // Convert to percentage
      });
    }
  }

  // Sort by similarity (highest first)
  return matches.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Check if similarity indicates a match
 */
export function isFaceMatch(similarity: number, threshold: number = 0.4): boolean {
  return similarity >= threshold;
}
