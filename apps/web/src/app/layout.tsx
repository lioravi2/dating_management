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
                    // Function to remove anti-flicker mask - multiple fallback strategies
                    var removed = false;
                    function removeAntiFlicker() {
                      if (removed) return;
                      try {
                        var style = document.getElementById('amplitude-anti-flicker');
                        if (style && style.parentNode) {
                          style.parentNode.removeChild(style);
                          removed = true;
                        } else if (style) {
                          style.remove();
                          removed = true;
                        }
                      } catch (e) {
                        // If removal fails, try to override with visible style
                        try {
                          var style = document.getElementById('amplitude-anti-flicker');
                          if (style) {
                            style.innerHTML = '* { visibility: visible !important; }';
                            removed = true;
                          }
                        } catch (e2) {
                          // Last resort: remove via style tag manipulation
                          try {
                            var styles = document.getElementsByTagName('style');
                            for (var i = 0; i < styles.length; i++) {
                              if (styles[i].id === 'amplitude-anti-flicker') {
                                styles[i].parentNode.removeChild(styles[i]);
                                removed = true;
                                break;
                              }
                            }
                          } catch (e3) {
                            // Force visibility as absolute last resort
                            try {
                              document.documentElement.style.setProperty('visibility', 'visible', 'important');
                              removed = true;
                            } catch (e4) {
                              console.error('Failed to remove anti-flicker:', e4);
                            }
                          }
                        }
                      }
                    }
                    
                    // Remove immediately on script execution (before any async operations)
                    // This ensures page is visible even if there are errors
                    removeAntiFlicker();
                    
                    var amplitudeApiKey = '${amplitudeApiKey}';
                    if (!amplitudeApiKey) {
                      return;
                    }
                    
                    // Multiple fallback timers to ensure removal (in case first attempt failed)
                    setTimeout(removeAntiFlicker, 100);  // Very fast fallback
                    setTimeout(removeAntiFlicker, 300);  // Fast fallback
                    setTimeout(removeAntiFlicker, 1000); // Original timeout
                    
                    // Remove on DOMContentLoaded if not already removed
                    if (document.readyState === 'loading') {
                      document.addEventListener('DOMContentLoaded', removeAntiFlicker, { once: true });
                    } else {
                      // DOM already loaded
                      removeAntiFlicker();
                    }
                    
                    // Remove on window load as final fallback
                    window.addEventListener('load', removeAntiFlicker, { once: true });
                    
                    // Remove on any error (including React errors)
                    window.addEventListener('error', removeAntiFlicker, { once: true });
                    window.addEventListener('unhandledrejection', removeAntiFlicker, { once: true });
                    
                    // Load experiment script
                    try {
                      var script = document.createElement('script');
                      script.src = 'https://cdn.amplitude.com/script/' + amplitudeApiKey + '.experiment.js';
                      script.async = true;
                      script.onload = removeAntiFlicker;
                      script.onerror = removeAntiFlicker;
                      document.head.appendChild(script);
                    } catch (e) {
                      // If script creation fails, ensure mask is removed
                      removeAntiFlicker();
                    }
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
