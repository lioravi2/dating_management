/**
 * TEST EMAIL PAGE
 * 
 * This page provides a simple UI to test Supabase's email sending capability.
 * This is for diagnostic purposes only and should be removed before production.
 */

'use client';

import { useState } from 'react';
import { environment } from '@/lib/environment';

export default function TestEmailPage() {
  const [email, setEmail] = useState('avilior@hotmail.com');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; message?: string; error?: string; details?: string } | null>(null);

  const handleTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const webAppUrl = process.env.NEXT_PUBLIC_WEB_APP_URL || environment.getOrigin();
      const response = await fetch(`${webAppUrl}/api/auth/test-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: data.message || 'Test email sent successfully',
        });
      } else {
        setResult({
          success: false,
          error: data.error || 'Failed to send test email',
          details: data.details || data.hint,
        });
      }
    } catch (error: any) {
      setResult({
        success: false,
        error: 'Network error',
        details: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      maxWidth: '600px', 
      margin: '50px auto', 
      padding: '20px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <h1 style={{ marginBottom: '10px' }}>Test Supabase Email Service</h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        This page tests if Supabase can send emails. Enter an email address that exists in your Supabase users table.
      </p>

      <form onSubmit={handleTest} style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>
            Email Address:
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '16px',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: loading ? '#ccc' : '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Sending...' : 'Send Test Email'}
        </button>
      </form>

      {result && (
        <div style={{
          padding: '15px',
          borderRadius: '4px',
          backgroundColor: result.success ? '#d1fae5' : '#fee2e2',
          border: `1px solid ${result.success ? '#10b981' : '#ef4444'}`,
        }}>
          {result.success ? (
            <div>
              <strong style={{ color: '#065f46' }}>✓ Success</strong>
              <p style={{ color: '#065f46', marginTop: '5px', marginBottom: '0' }}>
                {result.message}
              </p>
            </div>
          ) : (
            <div>
              <strong style={{ color: '#991b1b' }}>✗ Error</strong>
              <p style={{ color: '#991b1b', marginTop: '5px', marginBottom: '5px' }}>
                {result.error}
              </p>
              {result.details && (
                <p style={{ color: '#991b1b', fontSize: '14px', marginTop: '5px', marginBottom: '0' }}>
                  {result.details}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f3f4f6', borderRadius: '4px' }}>
        <h3 style={{ marginTop: '0', marginBottom: '10px' }}>What this test does:</h3>
        <ul style={{ marginBottom: '0', paddingLeft: '20px' }}>
          <li>Uses Supabase admin API to generate a magic link</li>
          <li>This should trigger Supabase to send an email</li>
          <li>If you receive the email: Email service is working ✓</li>
          <li>If you don't receive the email: Email service is not working ✗</li>
        </ul>
      </div>
    </div>
  );
}


