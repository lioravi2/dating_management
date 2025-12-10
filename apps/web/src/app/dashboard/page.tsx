import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import Header from '@/components/Header';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard',
};

export default async function DashboardPage() {
  const supabase = createSupabaseServerComponentClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/auth/signin');
  }

  // Get user profile and subscription
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single();

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header accountType={user?.account_type} />

      <Breadcrumbs />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-3xl font-bold mb-2">
            Welcome{user?.full_name ? `, ${user.full_name}` : ' back'}! 👋
          </h1>
          <p className="text-gray-600 mb-6">
            Here's your dashboard overview
          </p>
          
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold mb-3">Your Account Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{user?.email || session.user.email}</p>
              </div>
              {user?.full_name && (
                <div>
                  <p className="text-sm text-gray-500">Full Name</p>
                  <p className="font-medium">{user.full_name}</p>
                </div>
              )}
              {user?.created_at && (
                <div>
                  <p className="text-sm text-gray-500">Member Since</p>
                  <p className="font-medium">
                    {new Date(user.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/profile"
              className="bg-primary-50 border-2 border-primary-200 rounded-lg p-4 hover:bg-primary-100 transition-colors"
            >
              <h2 className="font-semibold text-lg mb-2">Profile</h2>
              <p className="text-sm text-gray-600">Update your profile</p>
            </Link>
            {user?.account_type === 'pro' && (
              <Link
                href="/billing"
                className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 hover:bg-blue-100 transition-colors"
              >
                <h2 className="font-semibold text-lg mb-2">Billing</h2>
                <p className="text-sm text-gray-600">Manage subscription</p>
              </Link>
            )}
            {(!user?.account_type || user.account_type === 'free') && (
              <Link
                href="/upgrade"
                className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 hover:bg-yellow-100 transition-colors"
              >
                <h2 className="font-semibold text-lg mb-2">Upgrade to Pro</h2>
                <p className="text-sm text-gray-600">Unlock premium features</p>
              </Link>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

