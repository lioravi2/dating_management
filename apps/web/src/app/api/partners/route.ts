import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/client';
import { FREE_TIER_PARTNER_LIMIT } from '@/lib/pricing';

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseRouteHandlerClient();
    const supabaseAdmin = createSupabaseAdminClient();
    
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await request.json();

    // Get user account type
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('account_type')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Failed to fetch user information' },
        { status: 500 }
      );
    }

    // Check partner limit for free users
    if (user.account_type === 'free') {
      // Count existing partners
      const { count, error: countError } = await supabaseAdmin
        .from('partners')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countError) {
        return NextResponse.json(
          { error: 'Failed to check partner limit' },
          { status: 500 }
        );
      }

      if (count !== null && count >= FREE_TIER_PARTNER_LIMIT) {
        const message = count === FREE_TIER_PARTNER_LIMIT
          ? `Your free subscription is limited to ${FREE_TIER_PARTNER_LIMIT} partners. Please upgrade to Pro to add more partners.`
          : `With a free subscription you can't add partners if you already have more than ${FREE_TIER_PARTNER_LIMIT} partners. Please upgrade to Pro and try again.`;
        
        return NextResponse.json(
          {
            error: 'PARTNER_LIMIT_REACHED',
            message,
            partnerCount: count,
          },
          { status: 403 }
        );
      }
    }

    // Create the partner
    const partnerData = {
      ...body,
      user_id: userId,
    };

    const { data: partner, error: partnerError } = await supabaseAdmin
      .from('partners')
      .insert(partnerData)
      .select()
      .single();

    if (partnerError) {
      return NextResponse.json(
        { error: partnerError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: partner }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating partner:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

