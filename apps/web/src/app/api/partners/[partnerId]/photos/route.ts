import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { v4 as uuidv4 } from 'uuid';

/**
 * Upload a photo to a specific partner
 * 
 * This endpoint handles the actual file upload after face analysis is complete
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { partnerId: string } }
) {
  try {
    const { partnerId } = params;
    console.log('[API] Photo upload request received for partner:', partnerId);
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const faceDescriptor = formData.get('faceDescriptor');
    const width = formData.get('width');
    const height = formData.get('height');

    console.log('[API] Upload request data:', {
      hasFile: !!file,
      fileName: file?.name,
      fileSize: file?.size,
      hasFaceDescriptor: !!faceDescriptor,
      width,
      height
    });

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

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

    // Generate unique file name
    // Structure: userId/partnerId/uuid.ext (for RLS policies)
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${partnerId}/${uuidv4()}.${fileExt}`;
    const storagePath = fileName; // Path relative to bucket root

    // Upload to Supabase Storage
    console.log('[API] Uploading to storage:', storagePath);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('partner-photos')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false,
      });

    console.log('[API] Storage upload result:', { success: !uploadError, error: uploadError?.message });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      // Check if bucket doesn't exist
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
        parsedFaceDescriptor = JSON.parse(faceDescriptor as string);
      } catch (e) {
        console.warn('Failed to parse face descriptor:', e);
      }
    }

    // Create database record
    console.log('[API] Creating database record...');
    const { data: photo, error: dbError } = await supabase
      .from('partner_photos')
      .insert({
        partner_id: partnerId,
        storage_path: storagePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
        width: width ? parseInt(width as string) : null,
        height: height ? parseInt(height as string) : null,
        face_descriptor: parsedFaceDescriptor,
        face_detection_attempted: parsedFaceDescriptor !== null,
      })
      .select()
      .single();

    if (dbError) {
      console.error('[API] Database insert error:', dbError);
      // Clean up uploaded file if database insert fails
      await supabase.storage.from('partner-photos').remove([storagePath]);
      return NextResponse.json(
        { error: 'Failed to save photo record', details: dbError.message },
        { status: 500 }
      );
    }

    // Set this photo as profile picture if partner doesn't have one yet
    const { data: currentPartner } = await supabase
      .from('partners')
      .select('profile_picture_storage_path')
      .eq('id', partnerId)
      .single();

    if (currentPartner && !currentPartner.profile_picture_storage_path) {
      console.log('[API] Setting first photo as profile picture');
      await supabase
        .from('partners')
        .update({ profile_picture_storage_path: storagePath })
        .eq('id', partnerId);
    }

    console.log('[API] Photo uploaded successfully:', photo.id);
    return NextResponse.json({ photo });
  } catch (error) {
    console.error('Error uploading photo:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Full error details:', { errorMessage, errorStack, error });
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
