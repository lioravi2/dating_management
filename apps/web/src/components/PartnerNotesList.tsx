'use client';

import { useEffect, useState } from 'react';
import { createSupabaseClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { format } from 'date-fns';
import type { PartnerNote } from '@/shared';

interface PartnerNotesListProps {
  partnerId: string;
}

export default function PartnerNotesList({ partnerId }: PartnerNotesListProps) {
  const [notes, setNotes] = useState<PartnerNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNotes();
    
    const supabase = createSupabaseClient();
    const channel = supabase
      .channel('partner_notes_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'partner_notes',
          filter: `partner_id=eq.${partnerId}`,
        },
        () => {
          loadNotes();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [partnerId]);

  const loadNotes = async () => {
    const supabase = createSupabaseClient();
    const { data } = await supabase
      .from('partner_notes')
      .select('*')
      .eq('partner_id', partnerId)
      .order('start_time', { ascending: false });

    if (data) {
      setNotes(data);
    }
    setLoading(false);
  };

  if (loading) {
    return <p className="text-gray-600">Loading notes...</p>;
  }

  if (notes.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600 mb-4">No notes yet.</p>
        <Link
          href={`/partners/${partnerId}/notes/new`}
          className="text-primary-600 hover:text-primary-700"
        >
          Add your first note
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notes.map((note) => (
        <Link
          key={note.id}
          href={`/partners/${partnerId}/notes/${note.id}`}
          className="block border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-semibold capitalize">
                {note.type.replace('_', ' ')}
              </h3>
              <p className="text-sm text-gray-600">
                {format(new Date(note.start_time), 'PPp')}
                {note.end_time &&
                  ` - ${format(new Date(note.end_time), 'PPp')}`}
              </p>
            </div>
            {note.google_calendar_event_id && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                Synced
              </span>
            )}
          </div>
          {note.location && (
            <p className="text-sm text-gray-600 mb-1">📍 {note.location}</p>
          )}
          {note.description && (
            <p className="text-sm text-gray-700 line-clamp-2">
              {note.description}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}

