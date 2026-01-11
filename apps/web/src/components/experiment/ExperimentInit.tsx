'use client';

import { useEffect } from 'react';
import { initExperiment } from '@/lib/experiment/client';

/**
 * Client component that initializes Amplitude Experiment SDK on app load
 * Should be called after Amplitude Analytics initialization
 * Add this to your root layout to enable Experiment features
 */
export default function ExperimentInit() {
  useEffect(() => {
    // Initialize Experiment SDK once when component mounts
    // This is async but we don't need to await it - it will initialize in the background
    initExperiment().catch((error) => {
      console.error('Failed to initialize Amplitude Experiment SDK:', error);
    });
  }, []);

  // This component doesn't render anything
  return null;
}
