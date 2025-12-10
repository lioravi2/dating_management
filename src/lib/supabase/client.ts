import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Client-side Supabase client
export const createSupabaseClient = () => {
  return createClientComponentClient();
};

