'use client';

import { useEffect } from 'react';

/**
 * Client component that injects the Amplitude Web Experiments script tag
 * This is required for the Visual Editor (VISUAL_EDITOR=true parameter)
 * 
 * Using a client component avoids React hydration errors with conditional Script rendering
 */
export default function WebExperimentScript() {
  useEffect(() => {
    // Get Amplitude API key
    const amplitudeApiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
    
    if (!amplitudeApiKey) {
      return;
    }
    
    // Check if script already exists
    const existingScript = document.querySelector(
      `script[src*="${amplitudeApiKey}.experiment.js"]`
    );
    
    if (existingScript) {
      return;
    }
    
    // Create and inject script tag
    const script = document.createElement('script');
    script.src = `https://cdn.amplitude.com/script/${amplitudeApiKey}.experiment.js`;
    script.async = true;
    script.id = 'amplitude-web-experiments';
    
    // Insert into head as early as possible
    document.head.appendChild(script);
    
    // Cleanup function (though script will remain after component unmount)
    return () => {
      const scriptElement = document.getElementById('amplitude-web-experiments');
      if (scriptElement) {
        scriptElement.remove();
      }
    };
  }, []);

  // This component doesn't render anything
  return null;
}