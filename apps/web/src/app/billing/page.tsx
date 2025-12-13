import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/client';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Breadcrumbs from '@/components/Breadcrumbs';
import Header from '@/components/Header';
import SubscriptionManagement from '@/components/SubscriptionManagement';
import SyncPaymentsButton from '@/components/SyncPaymentsButton';
import { formatPrice, getMonthlyPriceDisplay } from '@/lib/pricing';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Billing',
};

export const dynamic = 'force-dynamic';

export default async function BillingPage() {
  const supabase = createSupabaseServerComponentClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/auth/signin');
  }

  // Get user and subscription
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (!user) {
    redirect('/dashboard');
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', session.user.id)
    .maybeSingle();

  // Check if subscription has expired and update user account type if needed
  if (subscription && user.account_type === 'pro') {
    const now = new Date();
    const periodEnd = subscription.current_period_end 
      ? new Date(subscription.current_period_end)
      : null;

    // If subscription is canceled at period end and period has passed, set user to free
    if (
      subscription.cancel_at_period_end &&
      periodEnd &&
      now >= periodEnd
    ) {
      const supabaseAdmin = createSupabaseAdminClient();
      await supabaseAdmin
        .from('users')
        .update({ account_type: 'free' })
        .eq('id', session.user.id);
      
      // Refresh user data
      const { data: updatedUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (updatedUser) {
        user.account_type = updatedUser.account_type;
      }
    }
  }

  // Get payment history
  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .eq('user_id', session.user.id)
    .order('paid_at', { ascending: false })
    .limit(50);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header accountType={user.account_type} />

      <Breadcrumbs />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Billing & Subscription</h1>
          <p className="text-gray-600">Manage your subscription and view payment history</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Subscription Management</h2>
          <SubscriptionManagement
            subscription={subscription}
            accountType={user.account_type || 'free'}
          />
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Payment History</h2>
            {(!payments || payments.length === 0) && user?.account_type === 'pro' && (
              <SyncPaymentsButton />
            )}
          </div>
          {payments && payments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {payment.paid_at
                          ? new Date(payment.paid_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })
                          : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatPrice(payment.amount)} {payment.currency.toUpperCase()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            payment.status === 'succeeded'
                              ? 'bg-green-100 text-green-800'
                              : payment.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {payment.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No payment history yet.</p>
              {user.account_type === 'free' && (
                <Link
                  href="/upgrade"
                  className="mt-4 inline-block text-primary-600 hover:text-primary-700"
                >
                  Upgrade to Pro to see your payments here
                </Link>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


