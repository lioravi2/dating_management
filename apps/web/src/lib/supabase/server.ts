import { createServerComponentClient, createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Server component Supabase client
export const createSupabaseServerComponentClient = () => {
  return createServerComponentClient({ cookies });
};

// Route handler Supabase client (for API routes and route handlers)
export const createSupabaseRouteHandlerClient = () => {
  return createRouteHandlerClient({ cookies });
};

