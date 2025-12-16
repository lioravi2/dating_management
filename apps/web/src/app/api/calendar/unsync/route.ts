import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { getCalendarProvider } from '@/lib/calendar/factory';

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerComponentClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { activityId } = body;

    if (!activityId) {
      return NextResponse.json(
        { error: 'activityId is required' },
        { status: 400 }
      );
    }

    // Get activity
    const { data: activity, error: activityError } = await supabase
      .from('partner_notes')
      .select('google_calendar_event_id')
      .eq('id', activityId)
      .single();

    if (activityError || !activity) {
      return NextResponse.json(
        { error: 'Activity not found' },
        { status: 404 }
      );
    }

    if (!activity.google_calendar_event_id) {
      return NextResponse.json({
        success: true,
        message: 'Activity is not synced to calendar',
      });
    }

    // Get user's calendar connection
    const { data: connection, error: connectionError } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('provider', 'google')
      .single();

    if (connectionError || !connection) {
      // If no connection, just clear the event ID
      const { error: updateError } = await supabase
        .from('partner_notes')
        .update({ google_calendar_event_id: null })
        .eq('id', activityId);

      if (updateError) {
        return NextResponse.json(
          { error: 'Failed to clear calendar event ID' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Calendar event ID cleared (connection not found)',
      });
    }

    // Delete event from calendar
    try {
      const provider = getCalendarProvider('google');
      await provider.deleteEvent(connection, activity.google_calendar_event_id);
    } catch (deleteError: any) {
      // If deletion fails (e.g., event already deleted), still clear the ID
      console.warn('Error deleting calendar event (will clear ID anyway):', deleteError);
    }

    // Clear event ID from database
    const { error: updateError } = await supabase
      .from('partner_notes')
      .update({ google_calendar_event_id: null })
      .eq('id', activityId);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to clear calendar event ID' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Activity unsynced from calendar successfully',
    });
  } catch (error: any) {
    console.error('Calendar unsync error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}



