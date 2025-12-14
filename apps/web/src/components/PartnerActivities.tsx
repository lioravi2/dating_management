'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createSupabaseClient } from '@/lib/supabase/client';
import { PartnerActivity, PartnerActivityType, FREE_TIER_ACTIVITY_LIMIT } from '@/shared';
import Link from 'next/link';
import { format, isSameDay, parseISO, startOfDay } from 'date-fns';
import { useLoadScript, Autocomplete } from '@react-google-maps/api';

// Move libraries array outside component to prevent LoadScript reload warning
const GOOGLE_MAPS_LIBRARIES: ('places')[] = ['places'];

interface PartnerActivitiesProps {
  partnerId: string;
  initialActivities: PartnerActivity[];
}

export default function PartnerActivities({
  partnerId,
  initialActivities,
}: PartnerActivitiesProps) {
  const [activities, setActivities] = useState<PartnerActivity[]>(initialActivities);
  const [showForm, setShowForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState<PartnerActivity | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [userAccountType, setUserAccountType] = useState<'free' | 'pro'>('free');
  const [syncingActivities, setSyncingActivities] = useState<Set<string>>(new Set());
  const [syncErrors, setSyncErrors] = useState<Map<string, string>>(new Map());
  const supabase = createSupabaseClient();

  useEffect(() => {
    // Get user account type
    const fetchUserAccountType = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('users')
          .select('account_type')
          .eq('id', user.id)
          .single();
        if (data) {
          setUserAccountType(data.account_type);
        }
      }
    };
    fetchUserAccountType();
  }, [supabase]);

  const canAddActivity =
    userAccountType === 'pro' || activities.length < FREE_TIER_ACTIVITY_LIMIT;

  const handleAddActivity = async (formData: {
    start_time: string;
    end_time?: string;
    type: PartnerActivityType;
    location?: string;
    description?: string;
  }) => {
    if (!canAddActivity) {
      setMessage({
        type: 'error',
        text: `Free accounts are limited to ${FREE_TIER_ACTIVITY_LIMIT} activities. Please upgrade to Pro for unlimited activities.`
      });
      return;
    }

    setLoading(true);
    setMessage(null);
    const { data: activity, error } = await supabase
      .from('partner_notes')
      .insert([{ ...formData, partner_id: partnerId }])
      .select()
      .single();

    if (error) {
      console.error('Error creating activity:', error);
      setMessage({
        type: 'error',
        text: `Error creating activity: ${error.message}`
      });
    } else {
      // Update partner's updated_at timestamp
      await supabase
        .from('partners')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', partnerId);
      
      setActivities([activity, ...activities]);
      setShowForm(false);
      setMessage({
        type: 'success',
        text: 'Activity created successfully!'
      });
      // Clear success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    }
    setLoading(false);
  };

  const handleUpdateActivity = async (activityId: string, formData: {
    start_time: string;
    end_time?: string;
    type: PartnerActivityType;
    location?: string;
    description?: string;
  }) => {
    setLoading(true);
    setMessage(null);

    const { data: updatedActivity, error } = await supabase
      .from('partner_notes')
      .update(formData)
      .eq('id', activityId)
      .select()
      .single();

    if (error) {
      console.error('Error updating activity:', error);
      setMessage({
        type: 'error',
        text: `Error updating activity: ${error.message}`
      });
    } else {
      // Update partner's updated_at timestamp
      await supabase
        .from('partners')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', partnerId);

      // Update activity in state
      setActivities((prev) =>
        prev.map((a) => (a.id === activityId ? updatedActivity : a))
      );

      // If activity is synced, update calendar event
      if (updatedActivity.google_calendar_event_id) {
        try {
          await fetch('/api/calendar/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              activityId: updatedActivity.id,
              partnerId,
            }),
          });
        } catch (error) {
          console.error('Error syncing updated activity to calendar:', error);
          // Don't show error to user, just log it
        }
      }

      setEditingActivity(null);
      setMessage({
        type: 'success',
        text: 'Activity updated successfully!'
      });
      setTimeout(() => setMessage(null), 3000);
    }
    setLoading(false);
  };

  const handleSyncActivity = async (activityId: string) => {
    const activity = activities.find((a) => a.id === activityId);
    if (!activity) return;

    const isSynced = !!activity.google_calendar_event_id;
    
    setSyncingActivities((prev) => new Set(prev).add(activityId));
    setSyncErrors((prev) => {
      const newMap = new Map(prev);
      newMap.delete(activityId);
      return newMap;
    });

    try {
      const endpoint = isSynced ? '/api/calendar/unsync' : '/api/calendar/sync';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId,
          partnerId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync activity');
      }

      // Update activity in state
      if (isSynced) {
        // Unsynced - clear event ID
        setActivities((prev) =>
          prev.map((a) =>
            a.id === activityId
              ? { ...a, google_calendar_event_id: null }
              : a
          )
        );
      } else {
        // Synced - add event ID
        setActivities((prev) =>
          prev.map((a) =>
            a.id === activityId
              ? { ...a, google_calendar_event_id: data.event_id }
              : a
          )
        );
      }
    } catch (error: any) {
      console.error('Error syncing activity:', error);
      setSyncErrors((prev) => new Map(prev).set(activityId, error.message));
    } finally {
      setSyncingActivities((prev) => {
        const newSet = new Set(prev);
        newSet.delete(activityId);
        return newSet;
      });
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (!confirm('Are you sure you want to delete this activity?')) return;

    const activity = activities.find((a) => a.id === activityId);
    
    // If activity is synced, unsync it first
    if (activity?.google_calendar_event_id) {
      try {
        await fetch('/api/calendar/unsync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activityId }),
        });
      } catch (error) {
        console.error('Error unsyncing before delete:', error);
        // Continue with delete even if unsync fails
      }
    }

    const { error } = await supabase
      .from('partner_notes')
      .delete()
      .eq('id', activityId);

    if (error) {
      console.error('Error deleting activity:', error);
      setMessage({
        type: 'error',
        text: `Error deleting activity: ${error.message}`
      });
    } else {
      setActivities(activities.filter((a) => a.id !== activityId));
      setMessage({
        type: 'success',
        text: 'Activity deleted successfully!'
      });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  // Group activities by date
  const activitiesByDate = useMemo(() => {
    const grouped: { [key: string]: PartnerActivity[] } = {};
    activities.forEach((activity) => {
      const dateKey = format(parseISO(activity.start_time), 'yyyy-MM-dd');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(activity);
    });
    
    // Sort dates descending (newest first)
    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
    
    // Sort activities within each date by start_time descending
    sortedDates.forEach((date) => {
      grouped[date].sort((a, b) => 
        new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      );
    });
    
    return { grouped, sortedDates };
  }, [activities]);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Activity Timeline</h2>
        {canAddActivity ? (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            + Add Activity
          </button>
        ) : (
          <Link
            href="/upgrade"
            className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
          >
            Upgrade to Add More Activities
          </Link>
        )}
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded ${
            message.type === 'error'
              ? 'bg-red-50 text-red-800'
              : 'bg-green-50 text-green-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {userAccountType === 'free' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-yellow-800">
            Free account: {activities.length} / {FREE_TIER_ACTIVITY_LIMIT} activities used
          </p>
        </div>
      )}

      {(showForm || editingActivity) && (
        <ActivityForm
          activity={editingActivity || undefined}
          onSubmit={editingActivity 
            ? (data) => handleUpdateActivity(editingActivity.id, data)
            : handleAddActivity
          }
          onCancel={() => {
            setShowForm(false);
            setEditingActivity(null);
          }}
          loading={loading}
        />
      )}

      <div className="mt-6">
        {activities.length > 0 ? (
          <div className="space-y-8">
            {activitiesByDate.sortedDates.map((dateKey) => {
              const dateActivities = activitiesByDate.grouped[dateKey];
              const date = parseISO(dateKey);
              const isToday = isSameDay(date, new Date());
              const isYesterday = isSameDay(date, new Date(Date.now() - 86400000));
              
              let dateLabel: string;
              if (isToday) {
                dateLabel = 'Today';
              } else if (isYesterday) {
                dateLabel = 'Yesterday';
              } else {
                dateLabel = format(date, 'EEEE, MMMM d, yyyy');
              }

              return (
                <div key={dateKey} className="relative">
                  {/* Date Separator */}
                  <div className="sticky top-0 z-10 bg-white py-3 mb-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800">
                      {dateLabel}
                    </h3>
                  </div>

                  {/* Activities for this date */}
                  <div className="space-y-3 pl-4 border-l-2 border-gray-200">
                    {dateActivities.map((activity, index) => (
                      <div
                        key={activity.id}
                        className="relative -ml-2"
                      >
                        {/* Timeline dot */}
                        <div className="absolute -left-[9px] top-2 w-4 h-4 bg-primary-500 rounded-full border-2 border-white shadow-sm"></div>
                        
                        {/* Activity card */}
                        <div className="ml-6 bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <span className="bg-primary-100 text-primary-800 text-xs font-semibold px-2 py-1 rounded">
                                  {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 font-medium">
                                {format(parseISO(activity.start_time), 'h:mm a')}
                                {activity.end_time &&
                                  ` - ${format(parseISO(activity.end_time), 'h:mm a')}`}
                              </p>
                              {activity.location && (
                                <p className="text-sm text-gray-600 mt-1">
                                  📍 {activity.location}
                                </p>
                              )}
                              {activity.description && (
                                <p className="text-gray-900 mt-2 text-sm">{activity.description}</p>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 ml-4">
                              {/* Edit button */}
                              <button
                                onClick={() => {
                                  setEditingActivity(activity);
                                  setShowForm(false);
                                }}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                                title="Edit activity"
                              >
                                Edit
                              </button>
                              {/* Sync button */}
                              <button
                                onClick={() => handleSyncActivity(activity.id)}
                                disabled={syncingActivities.has(activity.id)}
                                className={`p-2 rounded transition-colors ${
                                  activity.google_calendar_event_id
                                    ? 'text-green-600 hover:text-green-800 hover:bg-green-50'
                                    : syncErrors.has(activity.id)
                                    ? 'text-red-600 hover:text-red-800 hover:bg-red-50'
                                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                                title={
                                  syncingActivities.has(activity.id)
                                    ? 'Syncing...'
                                    : activity.google_calendar_event_id
                                    ? 'Unsync from calendar'
                                    : syncErrors.has(activity.id)
                                    ? `Retry sync (${syncErrors.get(activity.id)})`
                                    : 'Sync to calendar'
                                }
                              >
                                {syncingActivities.has(activity.id) ? (
                                  <svg
                                    className="animate-spin h-5 w-5"
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                  >
                                    <circle
                                      className="opacity-25"
                                      cx="12"
                                      cy="12"
                                      r="10"
                                      stroke="currentColor"
                                      strokeWidth="4"
                                    ></circle>
                                    <path
                                      className="opacity-75"
                                      fill="currentColor"
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    ></path>
                                  </svg>
                                ) : activity.google_calendar_event_id ? (
                                  <svg
                                    className="h-5 w-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                    />
                                  </svg>
                                ) : (
                                  <svg
                                    className="h-5 w-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                                    />
                                  </svg>
                                )}
                              </button>
                              {/* Delete button */}
                              <button
                                onClick={() => handleDeleteActivity(activity.id)}
                                className="text-red-600 hover:text-red-800 text-sm"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-600 text-center py-8">No activities yet.</p>
        )}
      </div>
    </div>
  );
}

function ActivityForm({
  activity,
  onSubmit,
  onCancel,
  loading,
}: {
  activity?: PartnerActivity;
  onSubmit: (data: {
    start_time: string;
    end_time?: string;
    type: PartnerActivityType;
    location?: string;
    description?: string;
  }) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY || '',
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Initialize form data from activity if editing, otherwise use defaults
  const getInitialFormData = () => {
    if (activity) {
      const startDate = parseISO(activity.start_time);
      const endDate = activity.end_time ? parseISO(activity.end_time) : null;
      const allDay = startDate.getHours() === 0 && startDate.getMinutes() === 0 && 
                     (!endDate || (endDate.getHours() === 23 && endDate.getMinutes() === 59));
      
      return {
        start_date: format(startDate, 'yyyy-MM-dd'),
        start_time: allDay ? '00:00' : format(startDate, 'HH:mm'),
        has_end_time: !!activity.end_time,
        end_date: endDate ? format(endDate, 'yyyy-MM-dd') : format(startDate, 'yyyy-MM-dd'),
        end_time: endDate && !allDay ? format(endDate, 'HH:mm') : '',
        all_day: allDay,
        type: activity.type,
        location: activity.location || '',
        description: activity.description || '',
      };
    }
    
    return {
      start_date: new Date().toISOString().split('T')[0],
      start_time: new Date().toTimeString().slice(0, 5),
      has_end_time: false,
      end_date: '',
      end_time: '',
      all_day: false,
      type: 'date' as PartnerActivityType,
      location: '',
      description: '',
    };
  };

  const [formData, setFormData] = useState(getInitialFormData());

  // Update form data when activity changes (for edit mode)
  useEffect(() => {
    if (activity) {
      setFormData(getInitialFormData());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity?.id]); // Only update when activity ID changes

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const startDateTime = formData.all_day
      ? new Date(`${formData.start_date}T00:00:00`).toISOString()
      : new Date(`${formData.start_date}T${formData.start_time}:00`).toISOString();
    
    const endDateTime = formData.has_end_time && formData.end_date
      ? (formData.all_day
          ? new Date(`${formData.end_date}T23:59:59`).toISOString()
          : formData.end_time
          ? new Date(`${formData.end_date}T${formData.end_time}:00`).toISOString()
          : undefined)
      : undefined;

    onSubmit({
      start_time: startDateTime,
      end_time: endDateTime,
      type: formData.type,
      location: formData.location || undefined,
      description: formData.description || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="border border-gray-200 rounded-lg p-4 mb-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type *
          </label>
          <select
            value={formData.type}
            onChange={(e) =>
              setFormData({ ...formData, type: e.target.value as PartnerActivityType })
            }
            required
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="date">Date</option>
            <option value="chat">Chat</option>
            <option value="phone">Phone</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              id="all_day"
              checked={formData.all_day}
              onChange={(e) => setFormData({ ...formData, all_day: e.target.checked })}
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="all_day" className="ml-2 block text-sm text-gray-700">
              All day
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) =>
                  setFormData({ ...formData, start_date: e.target.value })
                }
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {!formData.all_day && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Time *
                </label>
                <input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) =>
                    setFormData({ ...formData, start_time: e.target.value })
                  }
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            )}
          </div>

          <div className="mt-4">
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="has_end_time"
                checked={formData.has_end_time}
                onChange={(e) => {
                  const hasEndTime = e.target.checked;
                  setFormData({
                    ...formData,
                    has_end_time: hasEndTime,
                    // Always copy start values when checkbox is checked
                    end_date: hasEndTime ? formData.start_date : formData.end_date,
                    end_time: hasEndTime ? formData.start_time : formData.end_time,
                  });
                }}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="has_end_time" className="ml-2 block text-sm text-gray-700">
                Has end time
              </label>
            </div>

            {formData.has_end_time && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) =>
                      setFormData({ ...formData, end_date: e.target.value })
                    }
                    onFocus={(e) => {
                      // When user clicks/focuses on end_date, populate with start_date if empty
                      if (!formData.end_date && formData.start_date) {
                        setFormData({ ...formData, end_date: formData.start_date });
                      }
                    }}
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                {!formData.all_day && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Time *
                    </label>
                    <input
                      type="time"
                      value={formData.end_time}
                      onChange={(e) =>
                        setFormData({ ...formData, end_time: e.target.value })
                      }
                      onFocus={(e) => {
                        // When user clicks/focuses on end_time, populate with start_time if empty
                        if (!formData.end_time && formData.start_time) {
                          setFormData({ ...formData, end_time: formData.start_time });
                        }
                      }}
                      required
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location
          </label>
          {isLoaded && !loadError ? (
            <Autocomplete
              onLoad={(autocomplete) => {
                autocompleteRef.current = autocomplete;
              }}
              onPlaceChanged={() => {
                if (autocompleteRef.current) {
                  const place = autocompleteRef.current.getPlace();
                  const address = place.formatted_address || place.name || '';
                  setFormData({ ...formData, location: address });
                }
              }}
            >
              <input
                type="text"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                placeholder="Search for a place or enter address manually"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </Autocomplete>
          ) : (
            <input
              type="text"
              value={formData.location}
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
              placeholder="e.g., Restaurant Name, Address"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          )}
          {loadError && (
            <p className="text-xs text-gray-500 mt-1">
              Google Places API not available. You can still enter location manually.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            rows={3}
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div className="flex space-x-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {loading 
              ? (activity ? 'Updating...' : 'Creating...') 
              : (activity ? 'Update Activity' : 'Create Activity')
            }
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

