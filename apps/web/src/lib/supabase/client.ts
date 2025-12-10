import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

// Client-side Supabase client
// Uses createClientComponentClient for cookie-based auth, but falls back to createClient
// if environment variables are not available (e.g., during build)
export const createSupabaseClient = () => {
  // Check if we're in a build environment (no env vars)
  if (typeof window === 'undefined') {
    // Server-side or build time - return a safe fallback
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      // During build, return a mock client that won't be used
      // This prevents build errors
      return createClient('https://placeholder.supabase.co', 'placeholder-key');
    }
    
    return createClient(supabaseUrl, supabaseAnonKey);
  }
  
  // Client-side - use the cookie-based client
  try {
    return createClientComponentClient();
  } catch (error) {
    // Fallback if createClientComponentClient fails
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase environment variables are required');
    }
    
    return createClient(supabaseUrl, supabaseAnonKey);
  }
};

// Server-side Supabase client (for API routes)
export const createSupabaseServerClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(supabaseUrl, supabaseAnonKey);
};

// Admin client (for server-side operations requiring service role)
export const createSupabaseAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase admin environment variables');
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

