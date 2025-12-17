import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import UpgradeForm from '@/components/UpgradeForm';
import Breadcrumbs from '@/components/Breadcrumbs';
import Header from '@/components/Header';
import { formatPrice } from '@/lib/pricing';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Upgrade to Pro',
};

export const dynamic = 'force-dynamic';

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
  
  // #region agent log
  console.log('[UpgradePage] Account type check:', {
    userId: session.user.id,
    accountType,
    willRedirect: accountType === 'pro',
  });
  // #endregion

  if (accountType === 'pro') {
    redirect('/profile');
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
                Unlimited partners
              </li>
              <li className="flex items-center">
                <span className="text-green-600 mr-2">✓</span>
                Unlimited activities
              </li>
              <li className="flex items-center">
                <span className="text-green-600 mr-2">✓</span>
                Unlimited photos
              </li>
              <li className="flex items-center">
                <span className="text-green-600 mr-2">✓</span>
                Calendar synchronization
              </li>
            </ul>
          </div>

          <UpgradeForm user={{ ...user, account_type: accountType as 'free' | 'pro' }} />
        </div>

        {/* Payment History Section - Only show if user has previous payments */}
        {payments && payments.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Payment History</h2>
            </div>
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
          </div>
        )}
      </main>
    </div>
  );
}

