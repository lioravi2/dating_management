'use client';

import { useEffect } from 'react';

/**
 * Global error handler component that catches unhandled errors and promise rejections.
 * This prevents errors from breaking the Amplitude Web Experiments Visual Editor overlay.
 * 
 * This component should be mounted once at the root level to catch:
 * - Unhandled promise rejections
 * - Global JavaScript errors
 * - Resource loading errors (optional)
 */
export default function GlobalErrorHandler() {
  useEffect(() => {
    // Handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Prevent the error from being logged to console in production
      // but still log in development for debugging
      if (process.env.NODE_ENV === 'development') {
        console.error('Unhandled promise rejection:', event.reason);
      }
      
      // Prevent the default browser behavior (error in console)
      // This ensures the Amplitude editor overlay continues to work
      event.preventDefault();
      
      // Optionally, you can log to an error reporting service here
      // Example: logErrorToService(event.reason, { type: 'unhandledRejection' });
    };

    // Handle global JavaScript errors
    const handleError = (event: ErrorEvent) => {
      // Only handle errors that aren't already handled by React Error Boundaries
      // React errors will be caught by ErrorBoundary components
      
      // Ignore errors from external scripts (like Amplitude) that might be expected
      const isExternalScript = event.filename && (
        event.filename.includes('amplitude.com') ||
        event.filename.includes('cdn.amplitude.com') ||
        event.filename.includes('experiment.js')
      );
      
      if (isExternalScript) {
        // Allow external script errors to pass through (they're handled by their own error handlers)
        return;
      }

      // In development, log all errors
      if (process.env.NODE_ENV === 'development') {
        console.error('Global error:', event.error, {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        });
      }

      // Prevent the error from breaking the page
      // The error is already logged, so we can prevent default behavior
      event.preventDefault();
      
      // Optionally, you can log to an error reporting service here
      // Example: logErrorToService(event.error, { type: 'globalError', ... });
    };

    // Add event listeners
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  // This component doesn't render anything
  return null;
}
