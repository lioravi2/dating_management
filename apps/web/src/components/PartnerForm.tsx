'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import type { Partner } from '@/shared';

interface PartnerFormProps {
  partner?: Partner | null;
}

export default function PartnerForm({ partner }: PartnerFormProps = {}) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    internal_id: partner?.internal_id || '',
    first_name: partner?.first_name || '',
    last_name: partner?.last_name || '',
    email: partner?.email || '',
    phone_number: partner?.phone_number || '',
    description: partner?.description || '',
    description_time: partner?.description_time
      ? new Date(partner.description_time).toISOString().slice(0, 16)
      : '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const supabase = createSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage('Not authenticated');
      setLoading(false);
      return;
    }

    const partnerData = {
      ...formData,
      user_id: user.id,
      internal_id: formData.internal_id || null,
      first_name: formData.first_name || null,
      last_name: formData.last_name || null,
      description_time: formData.description_time
        ? new Date(formData.description_time).toISOString()
        : null,
      email: formData.email || null,
      phone_number: formData.phone_number || null,
      description: formData.description || null,
    };

    if (partner) {
      // Update existing partner
      const { error } = await supabase
        .from('partners')
        .update(partnerData)
        .eq('id', partner.id);

      if (error) {
        setMessage(error.message);
      } else {
        router.push(`/partners/${partner.id}`);
      }
    } else {
      // Create new partner
      const { data, error } = await supabase
        .from('partners')
        .insert(partnerData)
        .select()
        .single();

      if (error) {
        setMessage(error.message);
      } else {
        router.push(`/partners/${data.id}`);
      }
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="internal_id"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Internal ID (optional identifier)
        </label>
        <input
          id="internal_id"
          type="text"
          value={formData.internal_id}
          onChange={(e) =>
            setFormData({ ...formData, internal_id: e.target.value })
          }
          placeholder="e.g., Partner-001"
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">
          Optional user-friendly identifier for this partner
        </p>
      </div>

      <div>
        <label
          htmlFor="first_name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          First Name
        </label>
        <input
          id="first_name"
          type="text"
          value={formData.first_name}
          onChange={(e) =>
            setFormData({ ...formData, first_name: e.target.value })
          }
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div>
        <label
          htmlFor="last_name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Last Name
        </label>
        <input
          id="last_name"
          type="text"
          value={formData.last_name}
          onChange={(e) =>
            setFormData({ ...formData, last_name: e.target.value })
          }
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

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
          value={formData.email}
          onChange={(e) =>
            setFormData({ ...formData, email: e.target.value })
          }
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div>
        <label
          htmlFor="phone_number"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Phone Number
        </label>
        <input
          id="phone_number"
          type="tel"
          value={formData.phone_number}
          onChange={(e) =>
            setFormData({ ...formData, phone_number: e.target.value })
          }
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Description
        </label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div>
        <label
          htmlFor="description_time"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Description Time
        </label>
        <input
          id="description_time"
          type="datetime-local"
          value={formData.description_time}
          onChange={(e) =>
            setFormData({ ...formData, description_time: e.target.value })
          }
          className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded ${
            message.includes('Error') || message.includes('error') || message.includes('violates') || message.includes('Not authenticated')
              ? 'bg-red-50 text-red-800'
              : 'bg-green-50 text-green-800'
          }`}
        >
          {message}
        </div>
      )}

      <div className="flex space-x-4">
        <button
          type="submit"
          disabled={loading}
          className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {loading ? 'Saving...' : partner ? 'Update Partner' : 'Create Partner'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

