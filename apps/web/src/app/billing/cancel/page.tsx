'use client';

import { useState } from 'react';
import { useNavigation } from '@/lib/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Breadcrumbs from '@/components/Breadcrumbs';

export const dynamic = 'force-dynamic';

export default function CancelSubscriptionPage() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      console.log('Canceling subscription with reason:', cancellationReason);
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancellationReason }),
      });

      const data = await response.json();
      console.log('Cancel subscription response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel subscription');
      }

      // Show success briefly, then redirect
      setMessage({ type: 'success', text: data.message || 'Subscription will be canceled at the end of the billing period.' });
      // Keep loading state true to show loader during redirect
      
      // Redirect to billing page after 1 second
      setTimeout(() => {
        navigation.push('/billing');
      }, 1000);
      // Don't set loading to false here - let it stay true until redirect
    } catch (error: any) {
      console.error('Cancel subscription error:', error);
      setMessage({ type: 'error', text: error.message || 'Error canceling subscription' });
      setLoading(false); // Only set loading to false on error
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

          {message && message.type === 'error' && (
            <div className="mb-4 p-3 rounded bg-red-50 text-red-800">
              {message.text}
            </div>
          )}

          {loading && message?.type === 'success' ? (
            <div className="mb-4 flex flex-col items-center justify-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
              <p className="text-gray-600">Processing...</p>
            </div>
          ) : (
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
                type="button"
                onClick={() => navigation.push('/billing')}
                disabled={loading}
                className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Keep Subscription
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && (
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {loading ? 'Processing...' : 'Cancel Subscription'}
              </button>
            </div>
          </form>
          )}
        </div>
      </main>
    </div>
  );
}

