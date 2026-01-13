import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
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
  // Get Amplitude API key at build time (available in server components)
  // Using NEXT_PUBLIC_ prefix makes it available in both server and client
  const amplitudeApiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;

  return (
    <html lang="en">
      <head>
        {/* Amplitude Web Experiments Anti-Flicker Snippet */}
        {/* This snippet prevents flickering by hiding content until the experiment script loads */}
        {/* It must be in <head> and execute before any page content renders */}
        {amplitudeApiKey && (
          <>
            <style
              id="amplitude-anti-flicker"
              dangerouslySetInnerHTML={{
                __html: `
                  * {
                    visibility: hidden !important;
                  }
                `,
              }}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  (function() {
                    var amplitudeApiKey = '${amplitudeApiKey}';
                    var script = document.createElement('script');
                    script.src = 'https://cdn.amplitude.com/script/' + amplitudeApiKey + '.experiment.js';
                    script.async = true;
                    script.onload = function() {
                      var style = document.getElementById('amplitude-anti-flicker');
                      if (style) {
                        style.remove();
                      }
                    };
                    script.onerror = function() {
                      // Remove anti-flicker mask even if script fails to load
                      var style = document.getElementById('amplitude-anti-flicker');
                      if (style) {
                        style.remove();
                      }
                    };
                    // Timeout fallback: remove mask after 1 second if script hasn't loaded
                    setTimeout(function() {
                      var style = document.getElementById('amplitude-anti-flicker');
                      if (style) {
                        style.remove();
                      }
                    }, 1000);
                    document.head.appendChild(script);
                  })();
                `,
              }}
            />
          </>
        )}
      </head>
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
