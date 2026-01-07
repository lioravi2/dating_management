'use client';

import { useEffect } from 'react';
import { initAmplitude } from '@/lib/analytics/client';

/**
 * Client component that initializes Amplitude analytics on app load
 * Add this to your root layout to enable Amplitude tracking
 */
export default function AmplitudeInit() {
  useEffect(() => {
    // Initialize Amplitude once when component mounts
    initAmplitude();
  }, []);

  // This component doesn't render anything
  return null;
}


