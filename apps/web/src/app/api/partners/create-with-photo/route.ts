import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/client';
import { FREE_TIER_PARTNER_LIMIT } from '@/lib/pricing';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a partner and upload a photo in one request
 * Used when creating a partner from photo upload flow
 */
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
    const formData = await request.formData();
    
    // Get partner data (optional fields)
    const first_name = formData.get('first_name') as string | null;
    const last_name = formData.get('last_name') as string | null;
    const email = formData.get('email') as string | null;
    const phone_number = formData.get('phone_number') as string | null;
    const description = formData.get('description') as string | null;
    
    // Get photo data
    const file = formData.get('file') as File | null;
    const faceDescriptor = formData.get('faceDescriptor') as string | null;
    const width = formData.get('width') as string | null;
    const height = formData.get('height') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

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

    // Create the partner (first_name is not required)
    const partnerData: any = {
      user_id: userId,
      first_name: first_name || null,
      last_name: last_name || null,
      email: email || null,
      phone_number: phone_number || null,
      description: description || null,
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

    const partnerId = partner.id;

    // Upload photo to the newly created partner
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${partnerId}/${uuidv4()}.${fileExt}`;
    const storagePath = fileName;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('partner-photos')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      // If photo upload fails, delete the partner we just created
      await supabaseAdmin.from('partners').delete().eq('id', partnerId);
      
      if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: 'Storage bucket not configured', 
            details: 'The partner-photos storage bucket does not exist. Please create it in Supabase Dashboard → Storage.' 
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to upload file', details: uploadError.message },
        { status: 500 }
      );
    }

    // Parse face descriptor if provided
    let parsedFaceDescriptor: number[] | null = null;
    if (faceDescriptor) {
      try {
        parsedFaceDescriptor = JSON.parse(faceDescriptor);
      } catch (e) {
        console.warn('Failed to parse face descriptor:', e);
      }
    }

    // Create database record for photo
    const { data: photo, error: dbError } = await supabaseAdmin
      .from('partner_photos')
      .insert({
        partner_id: partnerId,
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        width: width ? parseInt(width) : null,
        height: height ? parseInt(height) : null,
        face_descriptor: parsedFaceDescriptor,
        face_detection_attempted: parsedFaceDescriptor !== null,
      })
      .select()
      .single();

    if (dbError) {
      // If database insert fails, clean up storage and partner
      await supabaseAdmin.storage.from('partner-photos').remove([storagePath]);
      await supabaseAdmin.from('partners').delete().eq('id', partnerId);
      
      return NextResponse.json(
        { error: 'Failed to save photo record', details: dbError.message },
        { status: 500 }
      );
    }

    // Set this photo as profile picture (first photo)
    await supabaseAdmin
      .from('partners')
      .update({ 
        profile_picture_storage_path: storagePath,
        updated_at: new Date().toISOString()
      })
      .eq('id', partnerId);

    return NextResponse.json({ 
      partner,
      photo 
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating partner with photo:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

