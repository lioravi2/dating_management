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
        {/* Amplitude Web Experiments Script with Anti-Flicker */}
        {/* Anti-flicker is disabled when Visual Editor is active */}
        {amplitudeApiKey && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  // Check if Visual Editor is active - if so, skip anti-flicker
                  var isVisualEditor = window.location.search.indexOf('VISUAL_EDITOR=true') !== -1 ||
                                       window.location.search.indexOf('amplitude_visual_editor') !== -1;
                  
                  var amplitudeApiKey = '${amplitudeApiKey}';
                  if (!amplitudeApiKey) {
                    return;
                  }
                  
                  // Function to remove anti-flicker mask
                  function removeAntiFlicker() {
                    try {
                      var styleEl = document.getElementById('amplitude-anti-flicker');
                      if (styleEl && styleEl.parentNode) {
                        styleEl.parentNode.removeChild(styleEl);
                      } else if (styleEl) {
                        styleEl.remove();
                      }
                    } catch (e) {
                      console.error('Failed to remove anti-flicker:', e);
                    }
                  }
                  
                  // Only apply anti-flicker if Visual Editor is NOT active
                  if (!isVisualEditor) {
                    // Inject anti-flicker style to prevent flickering
                    var style = document.createElement('style');
                    style.id = 'amplitude-anti-flicker';
                    style.innerHTML = '* { visibility: hidden !important; }';
                    document.head.appendChild(style);
                    
                    // Remove anti-flicker when script loads or after timeout
                    setTimeout(removeAntiFlicker, 1000);
                    if (document.readyState === 'loading') {
                      document.addEventListener('DOMContentLoaded', removeAntiFlicker, { once: true });
                    } else {
                      removeAntiFlicker();
                    }
                    window.addEventListener('load', removeAntiFlicker, { once: true });
                  }
                  
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
                    
                    // Remove anti-flicker when script loads (only if it was applied)
                    if (!isVisualEditor) {
                      script.onload = removeAntiFlicker;
                      script.onerror = removeAntiFlicker;
                    }
                    
                    document.head.appendChild(script);
                  } catch (e) {
                    console.error('Failed to load Amplitude Web Experiments script:', e);
                    // Ensure anti-flicker is removed even if script fails
                    if (!isVisualEditor) {
                      removeAntiFlicker();
                    }
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
