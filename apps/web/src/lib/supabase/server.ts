import { createServerComponentClient, createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Server component Supabase client
// Note: createServerComponentClient automatically reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from environment
export const createSupabaseServerComponentClient = () => {
  // Validate environment variables exist (helpers will use them automatically)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required');
  }
  
  // The helpers automatically read from process.env, no need to pass options
  return createServerComponentClient({ cookies });
};

// Route handler Supabase client (for API routes and route handlers)
// Note: createRouteHandlerClient automatically reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from environment
export const createSupabaseRouteHandlerClient = () => {
  // Validate environment variables exist (helpers will use them automatically)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required');
  }
  
  // The helpers automatically read from process.env, no need to pass options
  return createRouteHandlerClient({ cookies });
};

