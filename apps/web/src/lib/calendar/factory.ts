/**
 * Calendar Provider Factory
 * Returns the appropriate provider instance based on provider type
 */

import type { CalendarProvider, CalendarProviderType } from './types';
import { googleCalendarProvider } from './providers/google';

const providers: Partial<Record<CalendarProviderType, CalendarProvider>> = {
  google: googleCalendarProvider,
  // outlook: outlookCalendarProvider, // TODO: Implement when adding Outlook support
};

export function getCalendarProvider(
  providerType: CalendarProviderType
): CalendarProvider {
  const provider = providers[providerType];
  if (!provider) {
    throw new Error(`Unsupported calendar provider: ${providerType}`);
  }
  return provider;
}

