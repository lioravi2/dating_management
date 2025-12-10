'use client';

import { useState } from 'react';
import { getStripe } from '@/lib/stripe';
import { getMonthlyPriceDisplay } from '@/lib/pricing';
import { User } from '@/shared';

interface UpgradeFormProps {
  user: User | { id: string; account_type?: string | null };
}

export default function UpgradeForm({ user }: UpgradeFormProps) {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const { sessionId, error: responseError } = data;

      if (responseError) {
        throw new Error(responseError);
      }

      if (!sessionId) {
        throw new Error('Failed to create checkout session');
      }

      const stripe = await getStripe();
      if (!stripe) {
        const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
        if (!publishableKey) {
          throw new Error('Stripe publishable key is missing. Please check your .env.local file and ensure NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is set.');
        }
        if (!publishableKey.startsWith('pk_test_') && !publishableKey.startsWith('pk_live_')) {
          throw new Error('Invalid Stripe publishable key format. The key should start with pk_test_ (for test mode) or pk_live_ (for live mode). Please check your .env.local file.');
        }
        throw new Error('Stripe not initialized. Please check your Stripe configuration and restart the dev server.');
      }

      const { error } = await stripe.redirectToCheckout({ sessionId });

      if (error) {
        console.error('Stripe checkout error:', error);
        alert('Error redirecting to checkout: ' + error.message);
        setLoading(false);
      }
      // If successful, user will be redirected, so don't set loading to false
    } catch (error: any) {
      console.error('Checkout error:', error);
      alert('Error starting checkout: ' + (error.message || 'Unknown error occurred'));
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="text-center mb-6">
        <div className="text-4xl font-bold mb-2">{getMonthlyPriceDisplay()}</div>
        <div className="text-gray-600">per month</div>
      </div>

      <button
        onClick={handleCheckout}
        disabled={loading}
        className="w-full bg-primary-600 text-white py-4 px-6 rounded-lg font-semibold text-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Subscribe to Pro'}
      </button>

      <p className="text-xs text-gray-500 text-center mt-4">
        Cancel anytime. Your subscription will renew automatically.
      </p>
    </div>
  );
}

