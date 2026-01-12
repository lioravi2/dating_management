'use client';

import { useEffect } from 'react';
import { initAmplitude } from '@/lib/analytics/client';

/**
 * Client component that initializes Amplitude analytics and Experiment SDK on app load
 * Add this to your root layout to enable Amplitude tracking and experiments
 * 
 * Note: Experiment SDK is automatically initialized by initAmplitude() after Analytics SDK
 */
export default function AmplitudeInit() {
  useEffect(() => {
    // Initialize Amplitude once when component mounts
    // This will also initialize Experiment SDK (called from initAmplitude)
    initAmplitude();
  }, []);

  // This component doesn't render anything
  return null;
}


