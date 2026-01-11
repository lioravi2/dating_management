'use client';

import { useEffect, useState, useRef } from 'react';
import { getVariant, fetchVariants, exposure, isExperimentInitialized } from './client';

/**
 * React hook for fetching experiment variant
 * 
 * @param flagKey - The feature flag or experiment key
 * @returns Object with variant, loading state, and error state
 */
export function useExperiment(flagKey: string) {
  const [variant, setVariant] = useState<{ key: string; value: any } | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Check initialization status and update state when it changes
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const checkInitialized = () => {
      const isInit = isExperimentInitialized();
      setInitialized((prev) => {
        // Only update if state actually changed
        if (isInit !== prev) {
          // Clear interval once initialization succeeds
          if (isInit && intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return isInit;
        }
        return prev;
      });
    };

    // Check immediately
    checkInitialized();

    // Only start polling if not already initialized
    if (!isExperimentInitialized()) {
      // Poll for initialization status (in case SDK initializes after mount)
      intervalRef.current = setInterval(checkInitialized, 100);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []); // Empty dependency array - only set up polling once

  useEffect(() => {
    if (!initialized) {
      // Don't set loading to false immediately - wait for initialization
      return;
    }

    let mounted = true;

    async function fetchVariant() {
      try {
        setLoading(true);
        setError(null);

        const result = await getVariant(flagKey);

        if (!mounted) return;

        if (result) {
          setVariant(result);
          // Track exposure automatically
          exposure(flagKey);
        } else {
          setVariant(undefined);
        }
      } catch (err) {
        if (!mounted) return;
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        console.error(`Failed to fetch variant for flag "${flagKey}":`, error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchVariant();

    return () => {
      mounted = false;
    };
  }, [flagKey, initialized]);

  return { variant, loading, error };
}

/**
 * React hook for boolean feature flags
 * 
 * @param flagKey - The feature flag key
 * @param defaultValue - Default value if flag is not found or fails to load (default: false)
 * @returns Boolean value of the flag
 */
export function useExperimentFlag(flagKey: string, defaultValue: boolean = false): boolean {
  const { variant, loading } = useExperiment(flagKey);

  if (loading) {
    return defaultValue;
  }

  if (!variant) {
    return defaultValue;
  }

  // Handle boolean values
  if (typeof variant.value === 'boolean') {
    return variant.value;
  }

  // Handle string values like "on"/"off", "true"/"false"
  if (typeof variant.value === 'string') {
    const lowerValue = variant.value.toLowerCase();
    if (lowerValue === 'true' || lowerValue === 'on' || lowerValue === '1') {
      return true;
    }
    if (lowerValue === 'false' || lowerValue === 'off' || lowerValue === '0') {
      return false;
    }
  }

  // Handle numeric values (0 = false, non-zero = true)
  if (typeof variant.value === 'number') {
    return variant.value !== 0;
  }

  return defaultValue;
}

/**
 * React hook for typed experiment values
 * 
 * @param flagKey - The feature flag or experiment key
 * @param defaultValue - Default value if flag is not found or fails to load
 * @returns Typed value of the flag
 */
export function useExperimentValue<T>(flagKey: string, defaultValue: T): T {
  const { variant, loading } = useExperiment(flagKey);

  if (loading || !variant) {
    return defaultValue;
  }

  return (variant.value as T) ?? defaultValue;
}

/**
 * React hook for fetching all experiment variants
 * 
 * @returns Object with variants, loading state, and error state
 */
export function useAllExperiments() {
  const [variants, setVariants] = useState<Record<string, { key: string; value: any }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Check initialization status and update state when it changes
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const checkInitialized = () => {
      const isInit = isExperimentInitialized();
      setInitialized((prev) => {
        // Only update if state actually changed
        if (isInit !== prev) {
          // Clear interval once initialization succeeds
          if (isInit && intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return isInit;
        }
        return prev;
      });
    };

    // Check immediately
    checkInitialized();

    // Only start polling if not already initialized
    if (!isExperimentInitialized()) {
      // Poll for initialization status (in case SDK initializes after mount)
      intervalRef.current = setInterval(checkInitialized, 100);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []); // Empty dependency array - only set up polling once

  useEffect(() => {
    if (!initialized) {
      // Don't set loading to false immediately - wait for initialization
      return;
    }

    let mounted = true;

    async function fetchAllVariants() {
      try {
        setLoading(true);
        setError(null);

        const result = await fetchVariants();

        if (!mounted) return;

        setVariants(result);

        // Track exposure for all variants
        Object.keys(result).forEach((flagKey) => {
          exposure(flagKey);
        });
      } catch (err) {
        if (!mounted) return;
        const error = err instanceof Error ? err : new Error('Unknown error');
        setError(error);
        console.error('Failed to fetch all variants:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchAllVariants();

    return () => {
      mounted = false;
    };
  }, [initialized]);

  return { variants, loading, error };
}
