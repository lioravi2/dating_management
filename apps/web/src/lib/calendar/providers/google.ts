/**
 * Google Calendar Provider Implementation
 */

import { google } from 'googleapis';
import type {
  CalendarProvider,
  CalendarConnection,
  CalendarEvent,
  CalendarEventCreateResult,
} from '../types';

export class GoogleCalendarProvider implements CalendarProvider {
  /**
   * Get OAuth2 client from connection
   */
  private getOAuth2Client(connection: CalendarConnection) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALENDAR_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: connection.access_token,
      refresh_token: connection.refresh_token || undefined,
    });

    return oauth2Client;
  }

  /**
   * Check if token is expired and refresh if needed
   */
  private async ensureValidToken(
    connection: CalendarConnection
  ): Promise<CalendarConnection> {
    if (!connection.expires_at) {
      return connection; // No expiration set, assume valid
    }

    const expiresAt = new Date(connection.expires_at);
    const now = new Date();
    const buffer = 5 * 60 * 1000; // 5 minutes buffer

    if (expiresAt.getTime() - now.getTime() < buffer) {
      // Token expired or about to expire, refresh it
      const refreshed = await this.refreshToken(connection);
      return {
        ...connection,
        ...refreshed,
      };
    }

    return connection;
  }

  async createEvent(
    connection: CalendarConnection,
    event: CalendarEvent
  ): Promise<CalendarEventCreateResult> {
    const validConnection = await this.ensureValidToken(connection);
    const auth = this.getOAuth2Client(validConnection);
    const calendar = google.calendar({ version: 'v3', auth });

    const calendarEvent = {
      summary: event.title,
      description: event.description || '',
      start: {
        dateTime: event.start_time,
        timeZone: event.timezone,
      },
      end: {
        dateTime: event.end_time,
        timeZone: event.timezone,
      },
      location: event.location || undefined,
    };

    const response = await calendar.events.insert({
      calendarId: validConnection.calendar_id || 'primary',
      requestBody: calendarEvent,
    });

    if (!response.data.id) {
      throw new Error('Failed to create calendar event: No event ID returned');
    }

    return {
      event_id: response.data.id,
      provider: 'google',
    };
  }

  async updateEvent(
    connection: CalendarConnection,
    eventId: string,
    event: CalendarEvent
  ): Promise<void> {
    const validConnection = await this.ensureValidToken(connection);
    const auth = this.getOAuth2Client(validConnection);
    const calendar = google.calendar({ version: 'v3', auth });

    const calendarEvent = {
      summary: event.title,
      description: event.description || '',
      start: {
        dateTime: event.start_time,
        timeZone: event.timezone,
      },
      end: {
        dateTime: event.end_time,
        timeZone: event.timezone,
      },
      location: event.location || undefined,
    };

    await calendar.events.update({
      calendarId: validConnection.calendar_id || 'primary',
      eventId: eventId,
      requestBody: calendarEvent,
    });
  }

  async deleteEvent(
    connection: CalendarConnection,
    eventId: string
  ): Promise<void> {
    const validConnection = await this.ensureValidToken(connection);
    const auth = this.getOAuth2Client(validConnection);
    const calendar = google.calendar({ version: 'v3', auth });

    await calendar.events.delete({
      calendarId: validConnection.calendar_id || 'primary',
      eventId: eventId,
    });
  }

  async refreshToken(
    connection: CalendarConnection
  ): Promise<Omit<CalendarConnection, 'id' | 'user_id' | 'provider' | 'created_at' | 'updated_at'>> {
    if (!connection.refresh_token) {
      throw new Error('No refresh token available');
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALENDAR_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: connection.refresh_token,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error('Failed to refresh access token');
    }

    return {
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token || connection.refresh_token,
      expires_at: credentials.expiry_date
        ? new Date(credentials.expiry_date).toISOString()
        : null,
      calendar_id: connection.calendar_id,
    };
  }
}

// Export singleton instance
export const googleCalendarProvider = new GoogleCalendarProvider();

