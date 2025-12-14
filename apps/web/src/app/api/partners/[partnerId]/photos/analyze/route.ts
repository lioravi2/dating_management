import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { findFaceMatches } from '@/lib/face-matching';
import { analyzePhotoUploadForPartner } from '@/lib/photo-upload-decision';
import { FaceMatch } from '@/shared';

/**
 * Analyze a photo upload for a specific partner
 * 
 * This endpoint receives a face descriptor and returns:
 * - Matches within the partner's photos
 * - Matches with other partners
 * - Decision on how to proceed
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { partnerId: string } }
) {
  try {
    const { partnerId } = params;
    console.log('[API] Photo analyze request received for partner:', partnerId);
    
    const body = await request.json();
    const { faceDescriptor } = body;

    if (!faceDescriptor || !Array.isArray(faceDescriptor)) {
      console.error('[API] Invalid face descriptor:', { hasDescriptor: !!faceDescriptor, isArray: Array.isArray(faceDescriptor) });
      return NextResponse.json(
        { error: 'Face descriptor is required' },
        { status: 400 }
      );
    }

    console.log('[API] Face descriptor received, length:', faceDescriptor.length);
    const supabase = createSupabaseRouteHandlerClient();
    
    // Get current user (more reliable than getSession for API routes)
    console.log('[API] Getting user...');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Verify partner belongs to user
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('id, first_name, last_name')
      .eq('id', partnerId)
      .eq('user_id', userId)
      .single();

    if (partnerError || !partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Get all photos for this partner (excluding current upload)
    const { data: partnerPhotos, error: partnerPhotosError } = await supabase
      .from('partner_photos')
      .select('*')
      .eq('partner_id', partnerId)
      .not('face_descriptor', 'is', null);

    if (partnerPhotosError) {
      return NextResponse.json(
        { error: 'Failed to fetch partner photos' },
        { status: 500 }
      );
    }

    // Get all photos for other partners
    // First get all other partner IDs for this user
    const { data: otherPartners, error: otherPartnersError } = await supabase
      .from('partners')
      .select('id, first_name, last_name, profile_picture_storage_path')
      .eq('user_id', userId)
      .neq('id', partnerId);

    if (otherPartnersError) {
      return NextResponse.json(
        { error: 'Failed to fetch other partners' },
        { status: 500 }
      );
    }

    const otherPartnerIds = (otherPartners || []).map(p => p.id);

    // Get photos for other partners
    // If no other partners exist, return empty array
    let otherPartnerPhotos: any[] = [];
    if (otherPartnerIds.length > 0) {
      const { data, error: otherPhotosError } = await supabase
        .from('partner_photos')
        .select('*')
        .in('partner_id', otherPartnerIds)
        .not('face_descriptor', 'is', null);

      if (otherPhotosError) {
        console.error('Error fetching other partner photos:', otherPhotosError);
        return NextResponse.json(
          { error: 'Failed to fetch other partner photos' },
          { status: 500 }
        );
      }
      otherPartnerPhotos = data || [];
    }

    // Find matches within partner's photos
    const partnerMatches = findFaceMatches(
      faceDescriptor,
      partnerPhotos || []
    );

    // Create a map of partner IDs to partner info
    const partnerMap = new Map(
      (otherPartners || []).map(p => [p.id, p])
    );

    // Find matches with other partners
    const otherPartnerMatches = findFaceMatches(
      faceDescriptor,
      otherPartnerPhotos
    );

    // Populate partner names and profile pictures in matches
    const enrichedOtherMatches: FaceMatch[] = otherPartnerMatches.map((match) => {
      const photo = otherPartnerPhotos.find(p => p.id === match.photo_id);
      if (photo) {
        const partner = partnerMap.get(photo.partner_id);
        return {
          ...match,
          partner_name: partner
            ? `${partner.first_name || ''} ${partner.last_name || ''}`.trim() || null
            : null,
          partner_profile_picture: partner?.profile_picture_storage_path || null,
        };
      }
      return match;
    });

    // Check if partner has other photos
    const partnerHasOtherPhotos = (partnerPhotos || []).length > 0;
    const otherPartnersHavePhotos = otherPartnerPhotos.length > 0;

    // Analyze and get decision
    console.log('[API] Analyzing photo upload decision...', {
      partnerMatches: partnerMatches.length,
      otherPartnerMatches: enrichedOtherMatches.length,
      partnerHasOtherPhotos,
      otherPartnersHavePhotos
    });
    
    const analysis = analyzePhotoUploadForPartner(
      partnerMatches,
      enrichedOtherMatches,
      partnerHasOtherPhotos,
      otherPartnersHavePhotos
    );

    console.log('[API] Analysis complete, decision:', analysis.decision.type);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Error analyzing photo:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Full error details:', { errorMessage, errorStack, error });
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}

