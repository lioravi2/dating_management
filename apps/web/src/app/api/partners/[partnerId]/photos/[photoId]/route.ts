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

    // First verify partner belongs to user
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id')
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting photo:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

