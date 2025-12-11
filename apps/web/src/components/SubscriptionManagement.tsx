'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMonthlyPriceDisplay } from '@/lib/pricing';

interface Subscription {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
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
      router.refresh();
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
            {!isCanceled && (
              <p className="text-sm text-gray-600 mt-1">
                Your subscription will automatically renew on this date for {getMonthlyPriceDisplay()}.
              </p>
            )}
            {isCanceled && (
              <p className="text-sm text-yellow-700 mt-2">
                Your subscription will remain active until this date.
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {isActive && (
            <button
              onClick={handleCancel}
              disabled={loading}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Cancel Subscription'}
            </button>
          )}
          {isCanceled && (
            <button
              onClick={handleResume}
              disabled={loading}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Resume Subscription'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


