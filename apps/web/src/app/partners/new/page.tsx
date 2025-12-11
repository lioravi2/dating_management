'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import Link from 'next/link';
import Header from '@/components/Header';
import Breadcrumbs from '@/components/Breadcrumbs';
import PartnerForm from '@/components/PartnerForm';

export const dynamic = 'force-dynamic';

export default function NewPartnerPage() {
  const router = useRouter();
  const supabase = createSupabaseClient();
  const [accountType, setAccountType] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('account_type')
          .eq('id', user.id)
          .single();
        setAccountType(userData?.account_type || null);
      }
    };
    fetchUser();
  }, [supabase]);
  return (
    <div className="min-h-screen bg-gray-50">
      <Header accountType={accountType} />
      <Breadcrumbs />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-6">Add New Partner</h1>
          <PartnerForm />
        </div>
      </main>
    </div>
  );
}

