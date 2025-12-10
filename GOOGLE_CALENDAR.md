# Google Calendar Integration Guide

## Overview

The Google Calendar integration allows bi-directional sync between partner notes and Google Calendar events.

## Current Status

The basic API route structure is in place (`apps/web/src/app/api/calendar/sync/route.ts`), but full OAuth implementation is required.

## Implementation Steps

### 1. Set Up Google Cloud Project

1. Go to https://console.cloud.google.com
2. Create a new project or select existing
3. Enable Google Calendar API:
   - APIs & Services → Library
   - Search "Google Calendar API"
   - Click Enable

### 2. Create OAuth 2.0 Credentials

1. Go to APIs & Services → Credentials
2. Click "Create Credentials" → "OAuth client ID"
3. Application type: Web application
4. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/google/callback` (local)
   - `https://your-domain.com/api/auth/google/callback` (production)
5. Save Client ID and Client Secret

### 3. Store OAuth Tokens

Create a table to store user OAuth tokens:

```sql
CREATE TABLE public.google_calendar_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.google_calendar_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tokens"
  ON public.google_calendar_tokens
  FOR ALL
  USING (auth.uid() = user_id);
```

### 4. Implement OAuth Flow

1. **Initiate OAuth** (`/api/auth/google/initiate`):
   - Generate OAuth URL
   - Redirect user to Google

2. **Handle Callback** (`/api/auth/google/callback`):
   - Exchange code for tokens
   - Store tokens in database
   - Redirect to success page

3. **Refresh Tokens** (when expired):
   - Use refresh token to get new access token
   - Update database

### 5. Sync to Google Calendar

When a note is created/updated:

1. Check if user has connected Google Calendar
2. Create/update event in Google Calendar
3. Store `google_calendar_event_id` in `partner_notes` table
4. Format event:
   - Title: Partner name + note type
   - Description: Note description
   - Start/End: Note times
   - Location: Note location

### 6. Sync from Google Calendar (Webhook)

1. Set up Google Calendar push notifications
2. When event changes in Google Calendar:
   - Find note by `google_calendar_event_id`
   - Update note with new event data
   - Maintain bi-directional sync

## Example Implementation

```typescript
// apps/web/src/lib/google-calendar.ts
import { google } from 'googleapis';

export async function createCalendarEvent(
  accessToken: string,
  note: PartnerNote,
  partner: Partner
) {
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const event = {
    summary: `${partner.first_name} - ${note.type}`,
    description: note.description || '',
    start: {
      dateTime: note.start_time,
      timeZone: 'UTC',
    },
    end: {
      dateTime: note.end_time || note.start_time,
      timeZone: 'UTC',
    },
    location: note.location || undefined,
  };

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
  });

  return response.data.id;
}
```

## Security Considerations

1. **Encrypt tokens** at rest (use Supabase Vault or similar)
2. **Refresh tokens** before expiration
3. **Handle token revocation** gracefully
4. **Rate limiting** on API calls
5. **User consent** - clearly explain what data is synced

## Testing

1. Use Google OAuth Playground for testing
2. Test token refresh flow
3. Test bi-directional sync
4. Test error handling (expired tokens, revoked access)

## Resources

- [Google Calendar API Docs](https://developers.google.com/calendar/api)
- [OAuth 2.0 Guide](https://developers.google.com/identity/protocols/oauth2)
- [Push Notifications](https://developers.google.com/calendar/api/guides/push)

