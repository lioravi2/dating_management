'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseClient } from '@/lib/supabase/client';
import Link from 'next/link';
import type { Partner } from '@/shared';

interface PartnerFormProps {
  partner?: Partner | null;
}

export default function PartnerForm({ partner }: PartnerFormProps = {}) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    first_name: partner?.first_name || '',
    last_name: partner?.last_name || '',
    email: partner?.email || '',
    phone_number: partner?.phone_number || '',
    description: partner?.description || '',
    facebook_profile: partner?.facebook_profile || '',
    x_profile: partner?.x_profile || '',
    linkedin_profile: partner?.linkedin_profile || '',
    instagram_profile: partner?.instagram_profile || '',
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

    // Auto-update description_time if description changed
    const descriptionChanged = partner && formData.description !== (partner.description || '');
    
    const partnerData: any = {
      user_id: user.id,
      first_name: formData.first_name || null,
      last_name: formData.last_name || null,
      email: formData.email || null,
      phone_number: formData.phone_number || null,
      description: formData.description || null,
      facebook_profile: formData.facebook_profile || null,
      x_profile: formData.x_profile || null,
      linkedin_profile: formData.linkedin_profile || null,
      instagram_profile: formData.instagram_profile || null,
    };

    // Update description_time if description changed (only on update, not create)
    if (partner && descriptionChanged && formData.description) {
      partnerData.description_time = new Date().toISOString();
    }

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
      // Create new partner via API route (for server-side validation)
      const response = await fetch('/api/partners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(partnerData),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.error === 'PARTNER_LIMIT_REACHED') {
          setMessage(result.message);
        } else {
          setMessage(result.error || 'Error creating partner');
        }
      } else {
        // Use full page reload to ensure fresh data from server
        window.location.href = '/partners';
      }
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="first_name"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          First Name *
        </label>
        <input
          id="first_name"
          type="text"
          value={formData.first_name}
          onChange={(e) =>
            setFormData({ ...formData, first_name: e.target.value })
          }
          required
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
        {partner?.description_time && (
          <p className="text-xs text-gray-500 mt-1">
            Last updated: {new Date(partner.description_time).toLocaleString()}
          </p>
        )}
      </div>

      <div className="border-t pt-4 mt-4">
        <h3 className="text-lg font-semibold mb-4">Social Media Profiles</h3>
        
        <div className="space-y-4">
          <div>
            <label
              htmlFor="facebook_profile"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Facebook Profile
            </label>
            <input
              id="facebook_profile"
              type="url"
              value={formData.facebook_profile}
              onChange={(e) =>
                setFormData({ ...formData, facebook_profile: e.target.value })
              }
              placeholder="https://facebook.com/..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="x_profile"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              X (Twitter) Profile
            </label>
            <input
              id="x_profile"
              type="url"
              value={formData.x_profile}
              onChange={(e) =>
                setFormData({ ...formData, x_profile: e.target.value })
              }
              placeholder="https://x.com/..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="linkedin_profile"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              LinkedIn Profile
            </label>
            <input
              id="linkedin_profile"
              type="url"
              value={formData.linkedin_profile}
              onChange={(e) =>
                setFormData({ ...formData, linkedin_profile: e.target.value })
              }
              placeholder="https://linkedin.com/in/..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="instagram_profile"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Instagram Profile
            </label>
            <input
              id="instagram_profile"
              type="url"
              value={formData.instagram_profile}
              onChange={(e) =>
                setFormData({ ...formData, instagram_profile: e.target.value })
              }
              placeholder="https://instagram.com/..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded ${
            message.includes('Error') || message.includes('error') || message.includes('violates') || message.includes('Not authenticated') || message.includes('limited')
              ? 'bg-red-50 text-red-800'
              : 'bg-green-50 text-green-800'
          }`}
        >
          <div className="flex flex-col gap-2">
            <span>{message}</span>
            {message.includes('limited') && (
              <Link
                href="/upgrade"
                className="inline-block mt-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors text-center"
              >
                Upgrade to Pro
              </Link>
            )}
          </div>
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

