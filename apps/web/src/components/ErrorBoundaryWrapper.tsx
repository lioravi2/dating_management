'use client';

import { ErrorBoundary } from './ErrorBoundary';
import AmplitudeInit from '@/components/analytics/AmplitudeInit';
import PageViewTracker from '@/components/analytics/PageViewTracker';
import ExperimentInit from '@/components/experiment/ExperimentInit';
import WebExperimentScript from '@/components/experiment/WebExperimentScript';
import { NavigationProviderWrapper } from '@/lib/navigation/navigation-provider-wrapper';
import VersionFooter from '@/components/VersionFooter';
import GlobalErrorHandler from '@/components/GlobalErrorHandler';

/**
 * Client-side wrapper that provides error boundaries for all client components.
 * This ensures React errors don't break the Amplitude Web Experiments Visual Editor overlay.
 * 
 * The error boundary is placed strategically to:
 * 1. Catch errors in client components without breaking the page
 * 2. Allow the Amplitude editor overlay to continue functioning
 * 3. Provide graceful error handling in production
 */
export default function ErrorBoundaryWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <GlobalErrorHandler />
      <ErrorBoundary>
        <WebExperimentScript />
        <AmplitudeInit />
        <ErrorBoundary>
          <ExperimentInit />
        </ErrorBoundary>
        <ErrorBoundary>
          <NavigationProviderWrapper>
            <ErrorBoundary>
              <PageViewTracker />
            </ErrorBoundary>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </NavigationProviderWrapper>
        </ErrorBoundary>
        <ErrorBoundary>
          <VersionFooter />
        </ErrorBoundary>
      </ErrorBoundary>
    </>
  );
}
