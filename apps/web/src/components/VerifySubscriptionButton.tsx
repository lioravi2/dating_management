'use client';

import { useState } from 'react';

export default function VerifySubscriptionButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleVerify = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/stripe/verify-subscription', {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setMessage('Subscription verified! Your account has been upgraded to Pro.');
        // Reload page after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        setMessage(data.message || 'Could not verify subscription. Please check your Stripe dashboard or contact support.');
      }
    } catch (error) {
      console.error('Verification error:', error);
      setMessage('Error verifying subscription. Please try again or contact support.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-4">
      <button
        onClick={handleVerify}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Verifying...' : 'Verify Subscription'}
      </button>
      {message && (
        <div
          className={`mt-2 p-3 rounded-lg ${
            message.includes('verified') || message.includes('upgraded')
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
          }`}
        >
          {message}
        </div>
      )}
    </div>
  );
}





