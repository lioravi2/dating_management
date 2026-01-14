import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ErrorBoundaryWrapper from '@/components/ErrorBoundaryWrapper';

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
        {/* Amplitude Web Experiments Script */}
        {/* Loads the experiment script for Visual Editor and experiments */}
        {/* Anti-flicker is NOT used - Visual Editor requires visible elements */}
        {amplitudeApiKey && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  var amplitudeApiKey = '${amplitudeApiKey}';
                  if (!amplitudeApiKey) {
                    return;
                  }
                  
                  // Function to load the experiment script
                  function loadExperimentScript() {
                    // Check if script already exists
                    var existingScript = document.querySelector('script[src*="' + amplitudeApiKey + '.experiment.js"]');
                    if (existingScript) {
                      return;
                    }
                    
                    // Load experiment script
                    try {
                      var script = document.createElement('script');
                      script.src = 'https://cdn.amplitude.com/script/' + amplitudeApiKey + '.experiment.js';
                      script.async = true;
                      script.id = 'amplitude-web-experiments';
                      document.head.appendChild(script);
                    } catch (e) {
                      console.error('Failed to load Amplitude Web Experiments script:', e);
                    }
                  }
                  
                  // Wait for DOM to be ready before loading script
                  // This ensures client components are fully hydrated
                  if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', loadExperimentScript);
                  } else {
                    // DOM is already ready, load immediately
                    // But also wait a bit for React hydration to complete
                    setTimeout(loadExperimentScript, 0);
                  }
                })();
              `,
            }}
          />
        )}
      </head>
      <body className={inter.className}>
        <ErrorBoundaryWrapper>
          {children}
        </ErrorBoundaryWrapper>
      </body>
    </html>
  );
}
