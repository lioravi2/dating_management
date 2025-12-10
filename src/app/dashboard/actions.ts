'use server';

import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function signOut() {
  const supabase = createSupabaseServerComponentClient();
  await supabase.auth.signOut();
  redirect('/');
}

