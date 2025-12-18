'use client';

import { useState } from 'react';
import { useNavigation } from '@/lib/navigation';
import { environment } from '@/lib/environment';

export default function SyncPaymentsButton() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/stripe/sync-payments', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync payments');
      }

      setMessage({ type: 'success', text: data.message || 'Payments synced successfully!' });
      // Note: router.refresh() is Next.js specific, using environment.reload() instead
      environment.reload();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Error syncing payments' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleSync}
        disabled={loading}
        className="text-sm bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
      >
        {loading ? 'Syncing...' : 'Sync Payments from Stripe'}
      </button>
      {message && (
        <div
          className={`mt-2 p-2 rounded text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  );
}






