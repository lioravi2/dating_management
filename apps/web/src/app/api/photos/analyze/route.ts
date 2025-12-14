import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { findFaceMatches } from '@/lib/face-matching';
import { analyzePhotoUploadWithoutPartner } from '@/lib/photo-upload-decision';
import { FaceMatch } from '@/shared';

/**
 * Analyze a photo upload without a selected partner
 * 
 * This endpoint receives a face descriptor and returns:
 * - Matches across all user's partners
 * - Decision: create new partner or warn about matches
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { faceDescriptor } = body;

    if (!faceDescriptor || !Array.isArray(faceDescriptor)) {
      return NextResponse.json(
        { error: 'Face descriptor is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseRouteHandlerClient();
    
    // Get current user (more reliable than getSession for API routes)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Get all partner IDs for this user
    const { data: userPartners, error: partnersError } = await supabase
      .from('partners')
      .select('id, first_name, last_name, profile_picture_storage_path')
      .eq('user_id', userId);

    if (partnersError) {
      return NextResponse.json(
        { error: 'Failed to fetch partners' },
        { status: 500 }
      );
    }

    const partnerIds = (userPartners || []).map(p => p.id);
    const partnerMap = new Map(
      (userPartners || []).map(p => [p.id, p])
    );

    // Get all photos for all user's partners
    // If no partners exist, return empty array
    let allPhotos: any[] = [];
    if (partnerIds.length > 0) {
      const { data, error: photosError } = await supabase
        .from('partner_photos')
        .select('*')
        .in('partner_id', partnerIds)
        .not('face_descriptor', 'is', null);

      if (photosError) {
        console.error('Error fetching photos:', photosError);
        return NextResponse.json(
          { error: 'Failed to fetch photos' },
          { status: 500 }
        );
      }
      allPhotos = data || [];
    }

    // Find matches across all partners
    const allMatches = findFaceMatches(
      faceDescriptor,
      allPhotos || []
    );

    // Enrich matches with partner names and profile pictures
    const enrichedMatches: FaceMatch[] = allMatches.map((match) => {
      const photo = (allPhotos || []).find(p => p.id === match.photo_id);
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

    // Analyze and get decision
    const result = analyzePhotoUploadWithoutPartner(enrichedMatches);

    return NextResponse.json({
      decision: result.decision,
      matches: result.matches,
    });
  } catch (error) {
    console.error('Error analyzing photo:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Full error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}

