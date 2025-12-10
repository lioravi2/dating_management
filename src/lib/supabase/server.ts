import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Server component Supabase client
export const createSupabaseServerComponentClient = () => {
  return createServerComponentClient({ cookies });
};

