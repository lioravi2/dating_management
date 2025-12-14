/**
 * Calendar Provider Types
 * Modular architecture to support multiple calendar providers (Google, Outlook, etc.)
 */

export type CalendarProviderType = 'google' | 'outlook';

export interface CalendarConnection {
  id: string;
  user_id: string;
  provider: CalendarProviderType;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  calendar_id: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id?: string; // Event ID from calendar provider
  title: string;
  description?: string;
  start_time: string; // ISO 8601 string
  end_time: string; // ISO 8601 string
  location?: string;
  timezone: string; // IANA timezone identifier
}

export interface CalendarEventCreateResult {
  event_id: string;
  provider: CalendarProviderType;
}

export interface CalendarProvider {
  /**
   * Create a calendar event
   */
  createEvent(
    connection: CalendarConnection,
    event: CalendarEvent
  ): Promise<CalendarEventCreateResult>;

  /**
   * Update an existing calendar event
   */
  updateEvent(
    connection: CalendarConnection,
    eventId: string,
    event: CalendarEvent
  ): Promise<void>;

  /**
   * Delete a calendar event
   */
  deleteEvent(
    connection: CalendarConnection,
    eventId: string
  ): Promise<void>;

  /**
   * Refresh access token if expired
   */
  refreshToken(
    connection: CalendarConnection
  ): Promise<Omit<CalendarConnection, 'id' | 'user_id' | 'provider' | 'created_at' | 'updated_at'>>;
}

