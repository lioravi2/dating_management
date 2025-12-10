import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import ProfileForm from '@/components/ProfileForm';
import Breadcrumbs from '@/components/Breadcrumbs';
import Header from '@/components/Header';
import SubscriptionVerifier from '@/components/SubscriptionVerifier';
import VerifySubscriptionButton from '@/components/VerifySubscriptionButton';
import { Suspense } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profile',
};

export default async function ProfilePage() {
  const supabase = createSupabaseServerComponentClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/auth/signin');
  }

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (!user) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header accountType={user.account_type} />

      <Breadcrumbs />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-6">Profile</h1>
          <Suspense fallback={null}>
            <SubscriptionVerifier />
          </Suspense>
          {user.account_type === 'free' && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 mb-2">
                If you just completed a payment but your account is still showing as Free, click below to verify your subscription:
              </p>
              <VerifySubscriptionButton />
            </div>
          )}
          <ProfileForm user={user} />
        </div>
      </main>
    </div>
  );
}

