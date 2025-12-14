import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';

/**
 * Delete a partner photo
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { partnerId: string; photoId: string } }
) {
  try {
    const { partnerId, photoId } = params;
    const supabase = createSupabaseRouteHandlerClient();
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // First verify partner belongs to user and get profile picture
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, profile_picture_storage_path')
      .eq('id', partnerId)
      .eq('user_id', user.id)
      .single();

    if (partnerError || !partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Get photo with storage path
    const { data: photo, error: photoError } = await supabase
      .from('partner_photos')
      .select('id, storage_path')
      .eq('id', photoId)
      .eq('partner_id', partnerId)
      .single();

    if (photoError || !photo) {
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 }
      );
    }

    // Check if this photo is the profile picture
    const isProfilePicture = partner.profile_picture_storage_path === photo.storage_path;

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from('partner-photos')
      .remove([photo.storage_path]);

    if (storageError) {
      console.error('Storage delete error:', storageError);
      // Continue with DB delete even if storage fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('partner_photos')
      .delete()
      .eq('id', photoId);

    if (dbError) {
      return NextResponse.json(
        { error: 'Failed to delete photo', details: dbError.message },
        { status: 500 }
      );
    }

    // If this was the profile picture, update it to another photo or null
    if (isProfilePicture) {
      // Find another photo from the same partner to use as profile picture
      const { data: otherPhotos, error: otherPhotosError } = await supabase
        .from('partner_photos')
        .select('storage_path')
        .eq('partner_id', partnerId)
        .limit(1)
        .single();

      const newProfilePicture = otherPhotos?.storage_path || null;

      // Update partner's profile picture and updated_at timestamp
      await supabase
        .from('partners')
        .update({ 
          profile_picture_storage_path: newProfilePicture,
          updated_at: new Date().toISOString() 
        })
        .eq('id', partnerId);
    } else {
      // Just update partner's updated_at timestamp
      await supabase
        .from('partners')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', partnerId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting photo:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

