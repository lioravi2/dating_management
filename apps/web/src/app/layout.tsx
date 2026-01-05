import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import VersionFooter from '@/components/VersionFooter';
import { NavigationProviderWrapper } from '@/lib/navigation/navigation-provider-wrapper';
import AmplitudeInit from '@/components/analytics/AmplitudeInit';
import PageViewTracker from '@/components/analytics/PageViewTracker';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'Dating Assistant',
    template: '%s | Dating Assistant',
  },
  description: 'Manage your dating life with ease',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AmplitudeInit />
        <NavigationProviderWrapper>
          <PageViewTracker />
          {children}
        </NavigationProviderWrapper>
        <VersionFooter />
      </body>
    </html>
  );
}
