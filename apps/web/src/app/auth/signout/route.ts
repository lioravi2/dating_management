import { createSupabaseRouteHandlerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const supabase = createSupabaseRouteHandlerClient();
  
  // Sign out from Supabase
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    console.error('Sign out error:', error);
  }
  
  // Clear all Supabase-related cookies
  const cookieStore = cookies();
  const cookieNames = [
    'sb-access-token',
    'sb-refresh-token',
    'supabase-auth-token',
  ];
  
  // Get all cookies and clear Supabase ones
  cookieStore.getAll().forEach((cookie) => {
    if (cookie.name.includes('supabase') || cookie.name.includes('sb-')) {
      cookieStore.delete(cookie.name);
    }
  });
  
  const requestUrl = new URL(request.url);
  const response = NextResponse.redirect(new URL('/', requestUrl.origin));
  
  // Also clear cookies in the response
  cookieNames.forEach((name) => {
    response.cookies.delete(name);
  });
  
  return response;
}

