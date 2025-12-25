import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/client';
import { createClient } from '@supabase/supabase-js';

/**
 * Delete a partner and all associated data (photos, activities)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { partnerId: string } }
) {
  try {
    const { partnerId } = params;
    
    // Check for Bearer token (mobile app) or use cookies (web app)
    const authHeader = request.headers.get('authorization');
    let supabase;
    let supabaseAdmin;
    let user;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Mobile app sends Bearer token
      const accessToken = authHeader.substring(7);
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      });
      
      const { data: { user: tokenUser }, error: userError } = await supabase.auth.getUser(accessToken);
      if (userError || !tokenUser) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      user = tokenUser;
      supabaseAdmin = createSupabaseAdminClient();
    } else {
      // Web app uses cookies
      supabase = createSupabaseRouteHandlerClient();
      supabaseAdmin = createSupabaseAdminClient();
      const { data: { user: cookieUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !cookieUser) {
        console.error('Auth error:', userError);
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      user = cookieUser;
    }
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // First verify partner belongs to user
    const { data: partner, error: partnerError } = await supabaseAdmin
      .from('partners')
      .select('id')
      .eq('id', partnerId)
      .eq('user_id', userId)
      .single();

    if (partnerError || !partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Get all photos for this partner to delete from storage
    const { data: photos, error: photosError } = await supabaseAdmin
      .from('partner_photos')
      .select('storage_path')
      .eq('partner_id', partnerId);

    if (photosError) {
      console.error('Error fetching photos:', photosError);
      // Continue with deletion even if photos fetch fails
    }

    // Delete photos from storage
    if (photos && photos.length > 0) {
      const storagePaths = photos.map(p => p.storage_path).filter(Boolean);
      if (storagePaths.length > 0) {
        const { error: storageError } = await supabaseAdmin.storage
          .from('partner-photos')
          .remove(storagePaths);

        if (storageError) {
          console.error('Storage delete error:', storageError);
          // Continue with DB deletion even if storage fails
        }
      }
    }

    // Delete all activities (partner_notes) for this partner
    const { error: activitiesError } = await supabaseAdmin
      .from('partner_notes')
      .delete()
      .eq('partner_id', partnerId);

    if (activitiesError) {
      console.error('Error deleting activities:', activitiesError);
      // Continue with partner deletion even if activities deletion fails
    }

    // Delete all photos from database
    const { error: photosDeleteError } = await supabaseAdmin
      .from('partner_photos')
      .delete()
      .eq('partner_id', partnerId);

    if (photosDeleteError) {
      console.error('Error deleting photos:', photosDeleteError);
      // Continue with partner deletion even if photos deletion fails
    }

    // Finally, delete the partner
    const { error: partnerDeleteError } = await supabaseAdmin
      .from('partners')
      .delete()
      .eq('id', partnerId);

    if (partnerDeleteError) {
      return NextResponse.json(
        { error: 'Failed to delete partner', details: partnerDeleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting partner:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}












