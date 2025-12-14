'use client';

import { useState, useEffect, useCallback } from 'react';
import { getFaceDetectionProvider } from '@/lib/face-detection/factory';
import { IFaceDetectionProvider, FaceDetectionResult, MultipleFaceDetectionResult } from '@/lib/face-detection/types';

export function useFaceDetection() {
  const [provider] = useState<IFaceDetectionProvider>(() => getFaceDetectionProvider());
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        setLoading(true);
        await provider.initialize();
        if (mounted) {
          setInitialized(true);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize');
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [provider]);

  const detectFace = useCallback(async (
    image: HTMLImageElement | HTMLCanvasElement | ImageData
  ): Promise<FaceDetectionResult> => {
    return await provider.detectFace(image);
  }, [provider]);

  const detectAllFaces = useCallback(async (
    image: HTMLImageElement | HTMLCanvasElement | ImageData
  ): Promise<MultipleFaceDetectionResult> => {
    return await provider.detectAllFaces(image);
  }, [provider]);

  const calculateSimilarity = useCallback((
    descriptor1: number[],
    descriptor2: number[]
  ): number => {
    return provider.calculateSimilarity(descriptor1, descriptor2);
  }, [provider]);

  // Alias for backward compatibility
  const compareFaces = calculateSimilarity;

  return {
    modelsLoaded: initialized,
    loading,
    error: error || provider.getError(),
    detectFace,
    detectAllFaces,
    calculateSimilarity,
    compareFaces,
  };
}
