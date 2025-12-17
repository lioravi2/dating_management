'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatPrice } from '@/lib/pricing';

interface Subscription {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  price_amount: number | null;
  billing_interval: 'day' | 'month' | 'year' | null;
}

interface SubscriptionManagementProps {
  subscription: Subscription | null;
  accountType: string;
}

export default function SubscriptionManagement({
  subscription,
  accountType,
}: SubscriptionManagementProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const router = useRouter();

  const handleCancel = () => {
    router.push('/billing/cancel');
  };

  const handleResume = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/stripe/resume-subscription', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resume subscription');
      }

      setMessage({ type: 'success', text: data.message || 'Subscription has been resumed.' });
      
      // Force a full page reload to ensure server-side account_type is updated
      // router.refresh() may not update server component props properly
      setTimeout(() => {
        environment.reload();
      }, 500);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Error resuming subscription' });
    } finally {
      setLoading(false);
    }
  };

  if (accountType === 'free') {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-gray-600">You are currently on the free plan.</p>
        <a
          href="/upgrade"
          className="mt-4 inline-block bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          Upgrade to Pro
        </a>
      </div>
    );
  }

  const handleVerifySubscription = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/stripe/verify-subscription', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify subscription');
      }

      setMessage({ type: 'success', text: data.message || 'Subscription verified successfully!' });
      router.refresh();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Error verifying subscription' });
    } finally {
      setLoading(false);
    }
  };

  if (!subscription && accountType === 'pro') {
    return (
      <div className="space-y-4">
        {message && (
          <div
            className={`p-3 rounded ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800 mb-2">Subscription information not available.</p>
          <p className="text-sm text-yellow-700 mb-4">
            Your account is set to Pro, but subscription details are missing. This usually happens if the webhook didn't fire. Click below to sync your subscription from Stripe.
          </p>
          <button
            onClick={handleVerifySubscription}
            disabled={loading}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Sync Subscription from Stripe'}
          </button>
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">Subscription information not available.</p>
      </div>
    );
  }

  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end)
    : null;
  const isCanceled = subscription.cancel_at_period_end;
  const isActive = subscription.status === 'active' && !isCanceled;

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`p-3 rounded ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="font-semibold text-lg">Pro Subscription</h3>
            <p className="text-sm text-gray-600">
              Status: <span className="capitalize font-medium">{subscription.status}</span>
            </p>
          </div>
          {isActive && (
            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
              Active
            </span>
          )}
          {isCanceled && (
            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold">
              Canceling
            </span>
          )}
        </div>

        {periodEnd && (
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              {isCanceled
                ? 'Access ends on:'
                : 'Auto-renewal date:'}
            </p>
            <p className="font-medium text-lg">
              {periodEnd.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            {!isCanceled && subscription.price_amount && subscription.billing_interval && (
              <p className="text-sm text-gray-600 mt-1">
                Your subscription will automatically renew on this date for {formatPrice(subscription.price_amount)}
                {subscription.billing_interval === 'day' && ' per day'}
                {subscription.billing_interval === 'month' && ' per month'}
                {subscription.billing_interval === 'year' && ' per year'}.
              </p>
            )}
            {isCanceled && (
              <p className="text-sm text-yellow-700 mt-2">
                Your subscription will remain active until this date.
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2 flex-wrap">
          {isActive && (
            <button
              onClick={handleCancel}
              disabled={loading}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {loading ? 'Processing...' : 'Cancel Subscription'}
            </button>
          )}
          {isCanceled && (
            <button
              onClick={handleResume}
              disabled={loading}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {loading ? 'Processing...' : 'Resume Subscription'}
            </button>
          )}
          <button
            onClick={handleVerifySubscription}
            disabled={loading}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {loading ? 'Syncing...' : 'Sync Subscription from Stripe'}
          </button>
        </div>
      </div>
    </div>
  );
}


