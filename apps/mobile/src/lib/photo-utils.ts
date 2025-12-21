/**
 * Utility functions for working with partner photos in mobile app
 */

/**
 * Get the public URL for a photo from its storage path
 */
export function getPhotoUrl(storagePath: string, supabaseUrl?: string): string {
  const baseUrl = supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  if (!baseUrl) {
    console.warn('EXPO_PUBLIC_SUPABASE_URL is not set');
    return '';
  }
  return `${baseUrl}/storage/v1/object/public/partner-photos/${storagePath}`;
}

/**
 * Get the profile picture URL for a partner
 * Returns null if no profile picture is set
 */
export function getPartnerProfilePictureUrl(
  partner: { profile_picture_storage_path: string | null },
  supabaseUrl?: string
): string | null {
  if (!partner.profile_picture_storage_path) {
    return null;
  }
  return getPhotoUrl(partner.profile_picture_storage_path, supabaseUrl);
}



