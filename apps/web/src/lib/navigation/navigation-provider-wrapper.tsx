'use client';

import { NavigationProvider } from './web-navigation';

export function NavigationProviderWrapper({ children }: { children: React.ReactNode }) {
  return <NavigationProvider>{children}</NavigationProvider>;
}

