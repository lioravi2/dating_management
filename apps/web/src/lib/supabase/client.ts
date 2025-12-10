import { createClient } from '@supabase/supabase-js';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Client-side Supabase client
// Uses createClientComponentClient to sync sessions to cookies for server-side access
export const createSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  // During build, if env vars are missing, return a placeholder client
  // This prevents build errors - the client won't actually be used during build
  if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window === 'undefined') {
      // Build time - return a safe placeholder
      return createClient('https://placeholder.supabase.co', 'placeholder-key');
    }
    // Runtime but missing env vars - this should not happen in production
    throw new Error('Supabase environment variables are required');
  }
  
  // Use createClientComponentClient in browser to sync sessions to cookies
  // This allows server components to read the session
  if (typeof window !== 'undefined') {
    try {
      return createClientComponentClient();
    } catch (error) {
      // Fallback to createClient if createClientComponentClient fails
      console.warn('Failed to create client component client, using fallback:', error);
      return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
    }
  }
  
  // Server-side fallback (shouldn't be used, but just in case)
  return createClient(supabaseUrl, supabaseAnonKey);
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

