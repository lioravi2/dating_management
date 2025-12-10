import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import UpgradeForm from '@/components/UpgradeForm';
import Breadcrumbs from '@/components/Breadcrumbs';
import Header from '@/components/Header';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Upgrade to Pro',
};

export default async function UpgradePage() {
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

  // Handle missing account_type (for users created before migration)
  const accountType = user.account_type || 'free';
  
  if (accountType === 'pro') {
    redirect('/profile');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header accountType={accountType} />

      <Breadcrumbs />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-4">Upgrade to Pro</h1>
            <p className="text-gray-600">
              Unlock premium features and advanced functionality
            </p>
          </div>

          <div className="bg-primary-50 border-2 border-primary-200 rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-bold mb-2">Pro Features</h2>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-center">
                <span className="text-green-600 mr-2">✓</span>
                Premium features
              </li>
              <li className="flex items-center">
                <span className="text-green-600 mr-2">✓</span>
                Google Calendar bi-directional sync
              </li>
              <li className="flex items-center">
                <span className="text-green-600 mr-2">✓</span>
                Priority support
              </li>
              <li className="flex items-center">
                <span className="text-green-600 mr-2">✓</span>
                Advanced analytics
              </li>
            </ul>
          </div>

          <UpgradeForm user={{ ...user, account_type: accountType as 'free' | 'pro' }} />
        </div>
      </main>
    </div>
  );
}

