import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Use service role key to check if user exists in auth.users
    // This requires the SUPABASE_SERVICE_ROLE_KEY env variable
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      // If service key not available, return null (we'll handle client-side)
      return NextResponse.json({ exists: null });
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Check if user exists by querying auth.users
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers();
    
    if (error) {
      console.error('Error checking user:', error);
      return NextResponse.json({ exists: null });
    }

    const userExists = users?.users?.some((user) => user.email === email) || false;

    return NextResponse.json({ exists: userExists });
  } catch (error: any) {
    console.error('Check user error:', error);
    return NextResponse.json({ exists: null }); // Return null on error, handle client-side
  }
}
