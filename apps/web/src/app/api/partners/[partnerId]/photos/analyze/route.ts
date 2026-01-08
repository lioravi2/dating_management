import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { findFaceMatches } from '@/lib/face-matching';
import { analyzePhotoUploadForPartner } from '@/lib/photo-upload-decision';
import { FaceMatch } from '@/shared';
import { track } from '@/lib/analytics/server';

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
    
    // Check for Authorization header (for mobile app) or use cookie-based auth (for web)
    const authHeader = request.headers.get('authorization');
    let supabase;
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
        console.error('Auth error:', userError);
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
      user = tokenUser;
    } else {
      // Web app uses cookies
      supabase = createSupabaseRouteHandlerClient();
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
      .select('id, first_name, last_name, profile_picture_storage_path, black_flag')
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
    const enrichedOtherMatches: (FaceMatch & { black_flag?: boolean })[] = otherPartnerMatches.map((match) => {
      const photo = otherPartnerPhotos.find(p => p.id === match.photo_id);
      if (photo) {
        const partner = partnerMap.get(photo.partner_id);
        return {
          ...match,
          partner_name: partner
            ? `${partner.first_name || ''} ${partner.last_name || ''}`.trim() || null
            : null,
          partner_profile_picture: partner?.profile_picture_storage_path || null,
          black_flag: partner?.black_flag || false,
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

    // Determine outcome for analytics
    let outcome: 'matches_found' | 'no_matches' | 'same_person_warning' | 'other_partners_warning';
    if (analysis.decision.type === 'proceed') {
      // Check if there are any matches
      const hasMatches = partnerMatches.length > 0 || enrichedOtherMatches.length > 0;
      outcome = hasMatches ? 'matches_found' : 'no_matches';
    } else if (analysis.decision.type === 'warn_same_person') {
      outcome = 'same_person_warning';
    } else if (analysis.decision.type === 'warn_other_partners') {
      outcome = 'other_partners_warning';
    } else {
      // Fallback - should not happen
      outcome = 'no_matches';
    }

    // Collect all matches for analytics
    const allMatches = [...partnerMatches, ...enrichedOtherMatches];
    const matchCount = allMatches.length;
    const similarityScores = allMatches.map(match => match.similarity);

    // Track partner analysis event
    try {
      const eventProperties: Record<string, any> = {
        outcome,
        partner_id: partnerId,
        match_count: matchCount,
        decision_type: analysis.decision.type,
      };
      
      // Only include similarity_scores if there are matches
      if (similarityScores.length > 0) {
        eventProperties.similarity_scores = similarityScores;
      }
      
      await track(
        '[Photo Upload - Partner Analysis]',
        userId,
        eventProperties
      );
    } catch (error) {
      // Log error but don't break the request flow
      console.error('[API] Failed to track analytics event:', error);
    }

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

