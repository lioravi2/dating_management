'use client';

import { useState } from 'react';
import { createSupabaseClient } from '@/lib/supabase/client';
import { User } from '@/shared';
import { useRouter } from 'next/navigation';

interface ProfileFormProps {
  user: User;
}

export default function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter();
  const supabase = createSupabaseClient();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const originalName = user.full_name || '';
  const [formData, setFormData] = useState({
    full_name: originalName,
  });

  // Check if form has changed
  const hasChanges = formData.full_name !== originalName;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasChanges) return;
    
    setLoading(true);
    setMessage('');

    const { error } = await supabase
      .from('users')
      .update({ full_name: formData.full_name })
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

        <button
          type="submit"
          disabled={loading || !hasChanges}
          className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}

