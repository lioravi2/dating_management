'use client';

import { useState, useEffect } from 'react';
import { createSupabaseClient } from '@/lib/supabase/client';
import { PartnerNote, PartnerNoteType, FREE_TIER_NOTE_LIMIT } from '@/shared';
import Link from 'next/link';
import { format } from 'date-fns';
import ConfirmDialog from './ConfirmDialog';
import AlertDialog from './AlertDialog';

interface PartnerNotesProps {
  partnerId: string;
  initialNotes: PartnerNote[];
}

export default function PartnerNotes({
  partnerId,
  initialNotes,
}: PartnerNotesProps) {
  const [notes, setNotes] = useState<PartnerNote[]>(initialNotes);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userAccountType, setUserAccountType] = useState<'free' | 'pro'>('free');
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; noteId: string | null }>({ open: false, noteId: null });
  const [deleting, setDeleting] = useState(false);
  const [alertDialog, setAlertDialog] = useState<{ open: boolean; title: string; message: string }>({ open: false, title: '', message: '' });
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

  const canAddNote =
    userAccountType === 'pro' || notes.length < FREE_TIER_NOTE_LIMIT;

  const handleAddNote = async (formData: {
    start_time: string;
    end_time?: string;
    type: PartnerNoteType;
    location?: string;
    description?: string;
  }) => {
    if (!canAddNote) {
      setAlertDialog({
        open: true,
        title: 'Note Limit Reached',
        message: `Free accounts are limited to ${FREE_TIER_NOTE_LIMIT} notes. Please upgrade to Pro for unlimited notes.`,
      });
      return;
    }

    setLoading(true);
    const { data: note, error } = await supabase
      .from('partner_notes')
      .insert([{ ...formData, partner_id: partnerId }])
      .select()
      .single();

    if (error) {
      console.error('Error creating note:', error);
      setAlertDialog({
        open: true,
        title: 'Error',
        message: 'Error creating note: ' + error.message,
      });
    } else {
      setNotes([note, ...notes]);
      setShowForm(false);
    }
    setLoading(false);
  };

  const handleDeleteClick = (noteId: string) => {
    setDeleteConfirm({ open: true, noteId });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm.noteId || deleting) return;

    try {
      setDeleting(true);
      const { error } = await supabase
        .from('partner_notes')
        .delete()
        .eq('id', deleteConfirm.noteId);

      if (error) {
        console.error('Error deleting note:', error);
        setAlertDialog({
          open: true,
          title: 'Error',
          message: 'Error deleting note: ' + error.message,
        });
      } else {
        setNotes(notes.filter((n) => n.id !== deleteConfirm.noteId));
      }
      setDeleteConfirm({ open: false, noteId: null });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Notes</h2>
        {canAddNote ? (
          <button
            onClick={() => setShowForm(!showForm)}
            disabled={loading}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            + Add Note
          </button>
        ) : (
          <Link
            href="/upgrade"
            className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 transition-colors"
          >
            Upgrade to Add More Notes
          </Link>
        )}
      </div>

      {userAccountType === 'free' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-yellow-800">
            Free account: {notes.length} / {FREE_TIER_NOTE_LIMIT} notes used
          </p>
        </div>
      )}

      {showForm && (
        <NoteForm
          onSubmit={handleAddNote}
          onCancel={() => setShowForm(false)}
          loading={loading}
        />
      )}

      <div className="space-y-4 mt-6">
        {notes.length > 0 ? (
          notes.map((note) => (
            <div
              key={note.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="bg-primary-100 text-primary-800 text-xs font-semibold px-2 py-1 rounded">
                      {note.type.replace('_', ' ').toUpperCase()}
                    </span>
                    {note.google_calendar_event_id && (
                      <span className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded">
                        🎭 Synced
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {format(new Date(note.start_time), 'PPp')}
                    {note.end_time &&
                      ` - ${format(new Date(note.end_time), 'PPp')}`}
                  </p>
                  {note.location && (
                    <p className="text-sm text-gray-600 mt-1">
                      📍 {note.location}
                    </p>
                  )}
                  {note.description && (
                    <p className="text-gray-900 mt-2">{note.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteClick(note.id)}
                  className="text-red-600 hover:text-red-800 ml-4"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-600 text-center py-8">No notes yet.</p>
        )}
      </div>

      <ConfirmDialog
        open={deleteConfirm.open}
        title="Delete Note"
        message="Are you sure you want to delete this note?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          if (!deleting) {
            setDeleteConfirm({ open: false, noteId: null });
          }
        }}
        confirmButtonClass="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        loading={deleting}
        loadingLabel="Deleting..."
      />

      <AlertDialog
        open={alertDialog.open}
        title={alertDialog.title}
        message={alertDialog.message}
        onClose={() => setAlertDialog({ open: false, title: '', message: '' })}
      />
    </div>
  );
}

function NoteForm({
  onSubmit,
  onCancel,
  loading,
}: {
  onSubmit: (data: {
    start_time: string;
    end_time?: string;
    type: PartnerNoteType;
    location?: string;
    description?: string;
  }) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [formData, setFormData] = useState({
    start_time: new Date().toISOString().slice(0, 16),
    end_time: '',
    type: 'actual_date' as PartnerNoteType,
    location: '',
    description: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      start_time: new Date(formData.start_time).toISOString(),
      end_time: formData.end_time
        ? new Date(formData.end_time).toISOString()
        : undefined,
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
              setFormData({ ...formData, type: e.target.value as PartnerNoteType })
            }
            required
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="in-app_chat">In-App Chat</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="phone">Phone</option>
            <option value="actual_date">Actual Date</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Time *
          </label>
          <input
            type="datetime-local"
            value={formData.start_time}
            onChange={(e) =>
              setFormData({ ...formData, start_time: e.target.value })
            }
            required
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Time (optional)
          </label>
          <input
            type="datetime-local"
            value={formData.end_time}
            onChange={(e) =>
              setFormData({ ...formData, end_time: e.target.value })
            }
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Location
          </label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) =>
              setFormData({ ...formData, location: e.target.value })
            }
            placeholder="e.g., Restaurant Name, Address"
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
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
            className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {loading ? 'Creating...' : 'Create Note'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

