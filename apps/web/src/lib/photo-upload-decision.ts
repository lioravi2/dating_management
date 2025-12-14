import { FaceMatch, PhotoUploadDecision, PhotoUploadAnalysis } from '@/shared';

/**
 * Analyze photo upload and determine the appropriate action
 * 
 * Use Case 1: Upload photo to specific partner
 * 
 * Decision Matrix:
 * - Partner Match Status: 4.1 (no photos), 4.2 (match), 4.3 (no match)
 * - Other Partners Match Status: 5.1 (no photos), 5.2 (match), 5.3 (no match)
 * 
 * Proceed: (4.1 AND 5.1) OR (4.1 AND 5.3) OR (4.2 AND 5.1) OR (4.2 AND 5.3)
 * Warn Same Person: (4.3 AND 5.1) OR (4.3 AND 5.3)
 * Warn Other Partners: (4.1 AND 5.2) OR (4.2 AND 5.2) OR (4.3 AND 5.2)
 */
export function analyzePhotoUploadForPartner(
  partnerMatches: FaceMatch[],
  otherPartnerMatches: FaceMatch[],
  partnerHasOtherPhotos: boolean,
  otherPartnersHavePhotos: boolean = false
): PhotoUploadAnalysis {
  // Determine partner match status
  const partnerMatchStatus = !partnerHasOtherPhotos 
    ? '4.1' // No photos yet
    : partnerMatches.length > 0 
      ? '4.2' // Match found
      : '4.3'; // No match

  // Determine other partners match status
  const otherPartnersMatchStatus = otherPartnerMatches.length > 0 
    ? '5.2' // Match found
    : !otherPartnersHavePhotos
      ? '5.1' // No photos of other partners yet
      : '5.3'; // Other partners have photos but no match

  let decision: PhotoUploadDecision;

  // Decision Tree based on condition combinations
  const condition = `${partnerMatchStatus}_${otherPartnersMatchStatus}`;

  // Proceed cases: (4.1 AND 5.1) OR (4.1 AND 5.3) OR (4.2 AND 5.1) OR (4.2 AND 5.3)
  if (
    condition === '4.1_5.1' ||
    condition === '4.1_5.3' ||
    condition === '4.2_5.1' ||
    condition === '4.2_5.3'
  ) {
    decision = {
      type: 'proceed',
      reason: partnerMatchStatus === '4.1' 
        ? 'no_matches' 
        : 'matches_partner_or_no_photos',
    };
  }
  // Warn Same Person: (4.3 AND 5.1) OR (4.3 AND 5.3)
  else if (condition === '4.3_5.1' || condition === '4.3_5.3') {
    decision = {
      type: 'warn_same_person',
      reason: 'doesnt_match_partner_has_photos',
    };
  }
  // Warn Other Partners: (4.1 AND 5.2) OR (4.2 AND 5.2) OR (4.3 AND 5.2)
  else if (
    condition === '4.1_5.2' ||
    condition === '4.2_5.2' ||
    condition === '4.3_5.2'
  ) {
    decision = {
      type: 'warn_other_partners',
      matches: otherPartnerMatches,
      reason: 'matches_other_partners',
    };
  }
  // Default: proceed (shouldn't happen, but safety fallback)
  else {
    decision = {
      type: 'proceed',
      reason: 'no_matches',
    };
  }

  return {
    decision,
    partnerMatches,
    otherPartnerMatches,
    partnerHasOtherPhotos,
  };
}

/**
 * Analyze photo upload without partner selection
 * 
 * Use Case 2: Upload photo without selecting partner
 * - Check matches across all user's partners
 * - Return decision: create new partner or warn about matches
 */
export function analyzePhotoUploadWithoutPartner(
  allPartnerMatches: FaceMatch[]
): { decision: 'create_new' | 'warn_matches'; matches: FaceMatch[] } {
  if (allPartnerMatches.length === 0) {
    return { decision: 'create_new', matches: [] };
  }

  return {
    decision: 'warn_matches',
    matches: allPartnerMatches,
  };
}
