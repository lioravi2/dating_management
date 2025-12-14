import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerComponentClient } from '@/lib/supabase/server';
import { getCalendarProvider } from '@/lib/calendar/factory';
import type { CalendarEvent } from '@/lib/calendar/types';

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
    const { activityId, partnerId } = body;

    if (!activityId || !partnerId) {
      return NextResponse.json(
        { error: 'activityId and partnerId are required' },
        { status: 400 }
      );
    }

    // Get activity
    const { data: activity, error: activityError } = await supabase
      .from('partner_notes')
      .select('*')
      .eq('id', activityId)
      .eq('partner_id', partnerId)
      .single();

    if (activityError || !activity) {
      return NextResponse.json(
        { error: 'Activity not found' },
        { status: 404 }
      );
    }

    // Get partner
    const { data: partner, error: partnerError } = await supabase
      .from('partners')
      .select('first_name, last_name')
      .eq('id', partnerId)
      .single();

    if (partnerError || !partner) {
      return NextResponse.json(
        { error: 'Partner not found' },
        { status: 404 }
      );
    }

    // Get user's calendar connection (Google for now)
    const { data: connection, error: connectionError } = await supabase
      .from('calendar_connections')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('provider', 'google')
      .single();

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'Google Calendar not connected. Please connect your calendar first.' },
        { status: 400 }
      );
    }

    // Get user timezone
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('timezone')
      .eq('id', session.user.id)
      .single();

    const userTimezone = user?.timezone || 'Asia/Jerusalem';

    // Format activity type for display
    const activityTypeLabel = activity.type.charAt(0).toUpperCase() + activity.type.slice(1);

    // Format partner name
    const partnerName = [partner.first_name, partner.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();

    // Format event title
    const eventTitle = partnerName
      ? `${activityTypeLabel} with ${partnerName}`
      : activityTypeLabel;

    // Calculate end time (30 minutes default if not set)
    let endTime = activity.end_time;
    if (!endTime) {
      const startTime = new Date(activity.start_time);
      endTime = new Date(startTime.getTime() + 30 * 60 * 1000).toISOString();
    }

    // Create calendar event
    const calendarEvent: CalendarEvent = {
      title: eventTitle,
      description: activity.description || undefined,
      start_time: activity.start_time,
      end_time: endTime,
      location: activity.location || undefined,
      timezone: userTimezone,
    };

    const provider = getCalendarProvider('google');
    
    // If activity already has a calendar event ID, update it; otherwise create new
    if (activity.google_calendar_event_id) {
      await provider.updateEvent(
        connection,
        activity.google_calendar_event_id,
        calendarEvent
      );
      
      return NextResponse.json({
        success: true,
        event_id: activity.google_calendar_event_id,
        message: 'Calendar event updated successfully',
      });
    } else {
      const result = await provider.createEvent(connection, calendarEvent);
      
      // Store event ID in database
      const { error: updateError } = await supabase
        .from('partner_notes')
        .update({ google_calendar_event_id: result.event_id })
        .eq('id', activityId);

      if (updateError) {
        console.error('Error updating activity with event ID:', updateError);
        // Event was created but we couldn't save the ID - this is a problem
        // Try to delete the event we just created
        try {
          await provider.deleteEvent(connection, result.event_id);
        } catch (deleteError) {
          console.error('Error cleaning up calendar event:', deleteError);
        }
        
        return NextResponse.json(
          { error: 'Failed to save calendar event ID' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        event_id: result.event_id,
        message: 'Activity synced to calendar successfully',
      });
    }
  } catch (error: any) {
    console.error('Calendar sync error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

