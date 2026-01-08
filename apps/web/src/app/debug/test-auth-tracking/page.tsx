'use client';

import { useState } from 'react';
import { useNavigation } from '@/lib/navigation';

export default function TestAuthTrackingPage() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/debug/test-auth-tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (!response.ok) {
        setError(data.message || 'Test failed');
        setResult(data);
      } else {
        setResult(data);
      }
    } catch (err: any) {
      setError(err.message || 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Test Auth Tracking Endpoint</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <button
            onClick={handleTest}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Testing...' : 'Test Auth Tracking'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Test Results</h2>
            
            <div className="mb-4">
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                result.status === 'success' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {result.status === 'success' ? '✓ Success' : '✗ Failed'}
              </span>
            </div>

            <div className="mb-4">
              <h3 className="font-semibold mb-2">Message:</h3>
              <p className="text-gray-700">{result.message}</p>
            </div>

            {result.results && (
              <div className="mb-4">
                <h3 className="font-semibold mb-2">Steps:</h3>
                <div className="space-y-2">
                  {result.results.steps?.map((step: any, index: number) => (
                    <div key={index} className="border-l-4 pl-4 py-2" style={{
                      borderColor: step.status === 'success' ? '#10b981' : step.status === 'failed' ? '#ef4444' : '#f59e0b'
                    }}>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Step {step.step}:</span>
                        <span className="font-medium">{step.name}</span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          step.status === 'success' 
                            ? 'bg-green-100 text-green-800' 
                            : step.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {step.status}
                        </span>
                      </div>
                      {step.error && (
                        <p className="text-red-600 text-sm mt-1">{step.error}</p>
                      )}
                      {step.data && (
                        <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto">
                          {JSON.stringify(step.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.results?.errors && result.results.errors.length > 0 && (
              <div className="mb-4">
                <h3 className="font-semibold text-red-800 mb-2">Errors:</h3>
                <ul className="list-disc list-inside text-red-600">
                  {result.results.errors.map((err: string, index: number) => (
                    <li key={index}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.instructions && (
              <div className="mb-4">
                <h3 className="font-semibold mb-2">Next Steps:</h3>
                <ol className="list-decimal list-inside space-y-1 text-gray-700">
                  {result.instructions.map((instruction: string, index: number) => (
                    <li key={index}>{instruction}</li>
                  ))}
                </ol>
              </div>
            )}

            <div className="mt-6">
              <h3 className="font-semibold mb-2">Full Response:</h3>
              <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={() => navigation.goBack()}
            className="text-blue-600 hover:text-blue-800"
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}
