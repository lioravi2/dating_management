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
                          return true;
                        } else if (style) {
                          style.remove();
                          removed = true;
                          return true;
                        }
                      } catch (e) {
                        // Continue to fallback methods
                      }
                      
                      // If removal failed, try to override with visible style
                      try {
                        var style = document.getElementById('amplitude-anti-flicker');
                        if (style) {
                          style.innerHTML = '* { visibility: visible !important; }';
                          removed = true;
                          return true;
                        }
                      } catch (e2) {
                        // Continue to next fallback
                      }
                      
                      // Last resort: force visibility on document element
                      try {
                        document.documentElement.style.setProperty('visibility', 'visible', 'important');
                        removed = true;
                        return true;
                      } catch (e3) {
                        console.error('Failed to remove anti-flicker:', e3);
                        return false;
                      }
                    }
                    
                    // Wait for style tag to exist before trying to remove it
                    function waitAndRemove() {
                      var attempts = 0;
                      var maxAttempts = 50; // 500ms max wait (50 * 10ms)
                      
                      function tryRemove() {
                        attempts++;
                        var style = document.getElementById('amplitude-anti-flicker');
                        
                        if (style) {
                          // Style exists, remove it
                          if (removeAntiFlicker()) {
                            return; // Successfully removed
                          }
                        }
                        
                        // If style doesn't exist yet and we haven't exceeded max attempts, try again
                        if (attempts < maxAttempts) {
                          setTimeout(tryRemove, 10);
                        } else {
                          // Max attempts reached, force visibility anyway
                          removeAntiFlicker();
                        }
                      }
                      
                      tryRemove();
                    }
                    
                    // Use requestAnimationFrame to ensure DOM is ready
                    if (typeof requestAnimationFrame !== 'undefined') {
                      requestAnimationFrame(function() {
                        waitAndRemove();
                      });
                    } else {
                      // Fallback for older browsers
                      waitAndRemove();
                    }
                    
                    // Also try immediate removal (in case DOM is already ready)
                    removeAntiFlicker();
                    
                    var amplitudeApiKey = '${amplitudeApiKey}';
                    if (!amplitudeApiKey) {
                      return;
                    }
                    
                    // Multiple fallback timers to ensure removal
                    setTimeout(removeAntiFlicker, 50);   // Very fast fallback
                    setTimeout(removeAntiFlicker, 100);  // Fast fallback
                    setTimeout(removeAntiFlicker, 300);  // Medium fallback
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
                    
                    // Use MutationObserver to watch for style tag addition (handles React hydration)
                    if (typeof MutationObserver !== 'undefined') {
                      var observer = new MutationObserver(function(mutations) {
                        mutations.forEach(function(mutation) {
                          mutation.addedNodes.forEach(function(node) {
                            if (node.nodeType === 1) { // Element node
                              if (node.id === 'amplitude-anti-flicker' || 
                                  (node.querySelector && node.querySelector('#amplitude-anti-flicker'))) {
                                setTimeout(removeAntiFlicker, 0);
                              }
                            }
                          });
                        });
                      });
                      
                      observer.observe(document.head, {
                        childList: true,
                        subtree: true
                      });
                      
                      // Stop observing after 5 seconds to avoid memory leaks
                      setTimeout(function() {
                        observer.disconnect();
                      }, 5000);
                    }
                    
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
