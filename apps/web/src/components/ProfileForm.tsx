'use client';

import { useState, useEffect } from 'react';
import { createSupabaseClient } from '@/lib/supabase/client';
import { User } from '@/shared';
import { useRouter } from 'next/navigation';

interface ProfileFormProps {
  user: User;
}

// Common timezones list
const COMMON_TIMEZONES = [
  { value: 'Asia/Jerusalem', label: 'Jerusalem (GMT+2)' },
  { value: 'America/New_York', label: 'New York (GMT-5)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (GMT-8)' },
  { value: 'Europe/London', label: 'London (GMT+0)' },
  { value: 'Europe/Paris', label: 'Paris (GMT+1)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (GMT+9)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (GMT+8)' },
  { value: 'Australia/Sydney', label: 'Sydney (GMT+10)' },
  { value: 'America/Chicago', label: 'Chicago (GMT-6)' },
  { value: 'America/Denver', label: 'Denver (GMT-7)' },
  { value: 'America/Phoenix', label: 'Phoenix (GMT-7)' },
  { value: 'America/Toronto', label: 'Toronto (GMT-5)' },
  { value: 'Europe/Berlin', label: 'Berlin (GMT+1)' },
  { value: 'Europe/Madrid', label: 'Madrid (GMT+1)' },
  { value: 'Europe/Rome', label: 'Rome (GMT+1)' },
  { value: 'Asia/Dubai', label: 'Dubai (GMT+4)' },
  { value: 'Asia/Singapore', label: 'Singapore (GMT+8)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (GMT+8)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (GMT-3)' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg (GMT+2)' },
];

export default function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter();
  const supabase = createSupabaseClient();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [calendarConnections, setCalendarConnections] = useState<Array<{ provider: string; connected: boolean }>>([]);
  const [connectingCalendar, setConnectingCalendar] = useState(false);
  const originalName = user.full_name || '';
  const originalTimezone = user.timezone || 'Asia/Jerusalem';
  
  // Get browser timezone on first load
  const [browserTimezone, setBrowserTimezone] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setBrowserTimezone(detected);
    }
  }, []);

  // Fetch calendar connections
  useEffect(() => {
    const fetchCalendarConnections = async () => {
      const { data } = await supabase
        .from('calendar_connections')
        .select('provider')
        .eq('user_id', user.id);
      
      const connected = data?.map(c => c.provider) || [];
      setCalendarConnections([
        { provider: 'google', connected: connected.includes('google') },
        { provider: 'outlook', connected: connected.includes('outlook') },
      ]);
    };
    fetchCalendarConnections();
  }, [supabase, user.id]);

  const [formData, setFormData] = useState({
    full_name: originalName,
    timezone: originalTimezone,
  });

  // Check if form has changed
  const hasChanges = formData.full_name !== originalName || formData.timezone !== originalTimezone;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges) return;
    
    setLoading(true);
    setMessage('');

    const { error } = await supabase
      .from('users')
      .update({ 
        full_name: formData.full_name,
        timezone: formData.timezone,
      })
      .eq('id', user.id);

    if (error) {
      console.error('Error updating profile:', error);
      setMessage('Error updating profile: ' + error.message);
    } else {
      setMessage('Profile updated successfully!');
      // Update original name to current value
      setTimeout(() => {
        router.refresh();
      }, 1000);
    }
    setLoading(false);
  };

  const handleConnectCalendar = async (provider: string) => {
    if (provider === 'google') {
      setConnectingCalendar(true);
      try {
        const response = await fetch('/api/calendar/google/initiate');
        const data = await response.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
        } else {
          setMessage('Error: ' + (data.error || 'Failed to initiate calendar connection'));
        }
      } catch (error: any) {
        setMessage('Error connecting calendar: ' + error.message);
        setConnectingCalendar(false);
      }
    }
  };

  const handleDisconnectCalendar = async (provider: string) => {
    if (!confirm(`Are you sure you want to disconnect your ${provider} calendar?`)) return;
    
    const { error } = await supabase
      .from('calendar_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', provider);

    if (error) {
      setMessage('Error disconnecting calendar: ' + error.message);
    } else {
      setCalendarConnections((prev) =>
        prev.map((c) => (c.provider === provider ? { ...c, connected: false } : c))
      );
      setMessage(`${provider} calendar disconnected successfully`);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div>
      {message && (
        <div
          className={`mb-4 p-3 rounded ${
            message.includes('successfully')
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={user.email || ''}
            disabled
            className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-gray-50 text-gray-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Email cannot be changed here
          </p>
        </div>

        {user.created_at && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Member Since
            </label>
            <p className="text-gray-900">
              {new Date(user.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
        )}

        <div>
          <label
            htmlFor="full_name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Full Name
          </label>
          <input
            id="full_name"
            type="text"
            value={formData.full_name}
            onChange={(e) => {
              setFormData({ ...formData, full_name: e.target.value });
              setMessage(''); // Clear message when user starts typing
            }}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label
            htmlFor="timezone"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Timezone
          </label>
          <select
            id="timezone"
            value={formData.timezone}
            onChange={(e) => {
              setFormData({ ...formData, timezone: e.target.value });
              setMessage(''); // Clear message when user changes timezone
            }}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            {COMMON_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
          {browserTimezone && browserTimezone !== formData.timezone && (
            <p className="text-xs text-gray-500 mt-1">
              Your browser timezone is {browserTimezone}.{' '}
              <button
                type="button"
                onClick={() => {
                  const tzOption = COMMON_TIMEZONES.find(tz => tz.value === browserTimezone);
                  if (tzOption) {
                    setFormData({ ...formData, timezone: browserTimezone });
                  } else {
                    // If browser timezone is not in common list, add it temporarily
                    setFormData({ ...formData, timezone: browserTimezone });
                  }
                }}
                className="text-primary-600 hover:text-primary-800 underline"
              >
                Use browser timezone
              </button>
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !hasChanges}
          className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>

      <div className="mt-8 pt-8 border-t border-gray-200">
        <h2 className="text-lg font-semibold mb-4">Calendar Connections</h2>
        <div className="space-y-3">
          {calendarConnections.map((connection) => (
            <div
              key={connection.provider}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <span className="font-medium capitalize">{connection.provider}</span>
                {connection.connected ? (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                    Connected
                  </span>
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    Not connected
                  </span>
                )}
              </div>
              {connection.connected ? (
                <button
                  onClick={() => handleDisconnectCalendar(connection.provider)}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={() => handleConnectCalendar(connection.provider)}
                  disabled={connectingCalendar}
                  className="text-sm text-primary-600 hover:text-primary-800 disabled:opacity-50"
                >
                  {connectingCalendar ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Connect your calendar to sync activities automatically. You can sync activities individually from the activity timeline.
        </p>
      </div>
    </div>
  );
}

