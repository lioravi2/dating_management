import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import VersionFooter from '@/components/VersionFooter';
import { NavigationProviderWrapper } from '@/lib/navigation/navigation-provider-wrapper';
import AmplitudeInit from '@/components/analytics/AmplitudeInit';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import ExperimentInit from '@/components/experiment/ExperimentInit';

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
  // Get Amplitude API key for Web Experiments script
  const amplitudeApiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
  
  return (
    <html lang="en">
      {/* Amplitude Web Experiments Script - Required for Visual Editor */}
      {/* This script enables Web Experiments and the Visual Editor (VISUAL_EDITOR=true parameter) */}
      {/* Using beforeInteractive strategy injects it into <head> as early as possible */}
      {amplitudeApiKey && (
        <Script
          id="amplitude-web-experiments"
          src={`https://cdn.amplitude.com/script/${amplitudeApiKey}.experiment.js`}
          strategy="beforeInteractive"
        />
      )}
      <body className={inter.className}>
        <AmplitudeInit />
        <ExperimentInit />
        <NavigationProviderWrapper>
          <PageViewTracker />
          {children}
        </NavigationProviderWrapper>
        <VersionFooter />
      </body>
    </html>
  );
}
