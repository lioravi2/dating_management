'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function SubscriptionVerifier() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const success = searchParams.get('success');
    
    if (success === 'true') {
      setIsVerifying(true);
      
      // Retry verification up to 3 times with delays
      const verifyWithRetry = async (attempt = 1) => {
        try {
          const response = await fetch('/api/stripe/verify-subscription', {
            method: 'POST',
          });
          
          const data = await response.json();
          
          if (data.success) {
            setMessage('Subscription activated! Your account has been upgraded to Pro.');
            // Reload page after a short delay to show updated status
            setTimeout(() => {
              window.location.href = '/profile';
            }, 2000);
            setIsVerifying(false);
            return;
          }
          
          // If failed and we have retries left, try again
          if (attempt < 3) {
            setTimeout(() => {
              verifyWithRetry(attempt + 1);
            }, 2000 * attempt); // Exponential backoff: 2s, 4s, 6s
          } else {
            setMessage('Payment successful, but subscription verification is pending. Please refresh the page in a moment or check your Stripe dashboard.');
            setIsVerifying(false);
          }
        } catch (error) {
          console.error('Verification error:', error);
          if (attempt < 3) {
            setTimeout(() => {
              verifyWithRetry(attempt + 1);
            }, 2000 * attempt);
          } else {
            setMessage('Payment successful! If your subscription doesn\'t appear, please refresh the page or contact support.');
            setIsVerifying(false);
          }
        }
      };
      
      // Start verification with a small delay to allow Stripe to process
      setTimeout(() => {
        verifyWithRetry();
      }, 1000);
    }
  }, [searchParams]);

  if (!message && !isVerifying) {
    return null;
  }

  return (
    <div
      className={`mb-4 p-4 rounded-lg ${
        message?.includes('activated') || message?.includes('successful')
          ? 'bg-green-50 text-green-800 border border-green-200'
          : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
      }`}
    >
      {isVerifying ? (
        <p>Verifying your subscription...</p>
      ) : (
        <p>{message}</p>
      )}
    </div>
  );
}

