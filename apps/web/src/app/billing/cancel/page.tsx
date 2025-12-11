'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Breadcrumbs from '@/components/Breadcrumbs';

export const dynamic = 'force-dynamic';

export default function CancelSubscriptionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancellationReason }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      setMessage({ type: 'success', text: data.message || 'Subscription will be canceled at the end of the billing period.' });
      
      // Redirect to billing page after 2 seconds
      setTimeout(() => {
        router.push('/billing');
      }, 2000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Error canceling subscription' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header accountType="pro" />
      <Breadcrumbs />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-4">Cancel Subscription</h1>
          
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 mb-2">
              <strong>Important:</strong> You will remain on Pro until the end of your billing period.
            </p>
            <p className="text-sm text-yellow-700">
              After cancellation, you'll continue to have access to all Pro features until your current billing period ends.
            </p>
          </div>

          {message && (
            <div
              className={`mb-4 p-3 rounded ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-800'
                  : 'bg-red-50 text-red-800'
              }`}
            >
              {message.text}
            </div>
          )}

          <form onSubmit={handleCancel} className="space-y-4">
            <div>
              <label
                htmlFor="reason"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Please tell us why you're canceling (optional)
              </label>
              <textarea
                id="reason"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Your feedback helps us improve..."
              />
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Processing...' : 'Cancel Subscription'}
              </button>
              <Link
                href="/billing"
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors text-center"
              >
                Keep Subscription
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

