import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { findFaceMatches } from '@/lib/face-matching';
import { analyzePhotoUploadWithoutPartner } from '@/lib/photo-upload-decision';
import { FaceMatch } from '@/shared';
import { track } from '@/lib/analytics/server';

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

    // Get all partner IDs for this user
    const { data: userPartners, error: partnersError } = await supabase
      .from('partners')
      .select('id, first_name, last_name, profile_picture_storage_path, black_flag')
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

    // Enrich matches with partner names, profile pictures, and black flag
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
          black_flag: partner?.black_flag || false,
        };
      }
      return match;
    });

    // Analyze and get decision
    const result = analyzePhotoUploadWithoutPartner(enrichedMatches);

    // Determine outcome for analytics
    let outcome: 'matches_found' | 'no_matches' | 'same_person_warning' | 'other_partners_warning';
    if (result.decision === 'create_new') {
      outcome = 'no_matches';
    } else if (result.decision === 'warn_matches') {
      outcome = 'matches_found';
    } else {
      // Fallback - should not happen
      outcome = 'no_matches';
    }

    // Collect matches for analytics
    const matchCount = result.matches.length;
    const similarityScores = result.matches.map(match => match.similarity);

    // Track partner analysis event
    try {
      const eventProperties: Record<string, any> = {
        outcome,
        match_count: matchCount,
        decision_type: result.decision,
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

