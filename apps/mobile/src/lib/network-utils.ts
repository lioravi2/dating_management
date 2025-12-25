import { supabase } from './supabase/client';

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  retryableStatusCodes?: number[];
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504], // Timeout, rate limit, server errors
};

/**
 * Check if an error is retryable
 */
function isRetryableError(error: any, retryableStatusCodes: number[]): boolean {
  // Network errors (TypeError) are retryable
  if (error?.name === 'TypeError' || error?.message?.includes('Network request failed') || error?.message?.includes('Failed to fetch')) {
    return true;
  }

  // AbortError is not retryable (user cancellation or timeout)
  if (error?.name === 'AbortError') {
    return false;
  }

  // Check status code if available
  if (error?.status && retryableStatusCodes.includes(error.status)) {
    return true;
  }

  return false;
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay for exponential backoff
 */
function calculateDelay(attempt: number, initialDelay: number, maxDelay: number, backoffMultiplier: number): number {
  const delay = initialDelay * Math.pow(backoffMultiplier, attempt);
  return Math.min(delay, maxDelay);
}

/**
 * Refresh session token if needed
 */
async function ensureValidSession(): Promise<string> {
  let { data: { session }, error } = await supabase.auth.getSession();
  
  // If no session or error, try to refresh
  if (!session || error) {
    const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshedSession) {
      throw new Error('Not authenticated. Please sign in again.');
    }
    session = refreshedSession;
  }

  // Check if token is close to expiring (within 5 minutes)
  if (session.expires_at) {
    const expiresAt = session.expires_at * 1000; // Convert to milliseconds
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    if (expiresAt - now < fiveMinutes) {
      // Token expires soon, refresh it
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshedSession) {
        throw new Error('Not authenticated. Please sign in again.');
      }
      session = refreshedSession;
    }
  }

  if (!session?.access_token) {
    throw new Error('Not authenticated. Please sign in again.');
  }

  return session.access_token;
}

/**
 * Make a resilient fetch request with retry logic and automatic session refresh
 */
export async function resilientFetch(
  url: string,
  options: RequestInit & { 
    retryOptions?: RetryOptions;
    timeout?: number;
  } = {}
): Promise<Response> {
  const {
    retryOptions = {},
    timeout = 30000, // 30 second default timeout
    ...fetchOptions
  } = options;

  const {
    maxRetries,
    initialDelay,
    maxDelay,
    backoffMultiplier,
    retryableStatusCodes,
  } = { ...DEFAULT_RETRY_OPTIONS, ...retryOptions };

  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Ensure we have a valid session token before each attempt
      const token = await ensureValidSession();
      
      // Create timeout controller
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => {
        timeoutController.abort();
      }, timeout);

      // Combine timeout signal with any existing abort signal
      let combinedSignal: AbortSignal | undefined;
      let cleanup: (() => void) | undefined;
      
      if (fetchOptions.signal) {
        const combinedController = new AbortController();
        const abortListener = () => combinedController.abort();
        fetchOptions.signal.addEventListener('abort', abortListener);
        timeoutController.signal.addEventListener('abort', abortListener);
        
        combinedSignal = combinedController.signal;
        cleanup = () => {
          fetchOptions.signal?.removeEventListener('abort', abortListener);
          timeoutController.signal.removeEventListener('abort', abortListener);
        };
      } else {
        combinedSignal = timeoutController.signal;
      }
      
      try {
        const response = await fetch(url, {
          ...fetchOptions,
          headers: {
            ...fetchOptions.headers,
            Authorization: `Bearer ${token}`,
          },
          signal: combinedSignal,
        });
        
        clearTimeout(timeoutId);
        cleanup?.();
        
        // If response is not ok, check if it's retryable
        if (!response.ok) {
          const status = response.status;
          if (isRetryableError({ status }, retryableStatusCodes) && attempt < maxRetries) {
            // Don't retry on 401/403 (auth errors) - these need user action
            if (status === 401 || status === 403) {
              throw new Error('Authentication failed. Please sign in again.');
            }
            
            const delay = calculateDelay(attempt, initialDelay, maxDelay, backoffMultiplier);
            console.log(`[NetworkUtils] Request failed with status ${status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
            await sleep(delay);
            lastError = new Error(`HTTP ${status}: ${response.statusText}`);
            continue;
          }
          
          // Not retryable or max retries reached
          return response;
        }
        
        return response;
      } catch (error: any) {
        clearTimeout(timeoutId);
        cleanup?.();
        
        // If it's an abort error (timeout or user cancellation), don't retry
        if (error?.name === 'AbortError') {
          throw error;
        }
        
        // Check if error is retryable
        if (isRetryableError(error, retryableStatusCodes) && attempt < maxRetries) {
          const delay = calculateDelay(attempt, initialDelay, maxDelay, backoffMultiplier);
          console.log(`[NetworkUtils] Request failed: ${error.message}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          await sleep(delay);
          lastError = error;
          continue;
        }
        
        // Not retryable or max retries reached
        throw error;
      }
    } catch (error: any) {
      // If it's an abort error or auth error, don't retry
      if (error?.name === 'AbortError' || error?.message?.includes('Not authenticated') || error?.message?.includes('Authentication failed')) {
        throw error;
      }
      
      lastError = error;
      
      // If this is the last attempt, throw the error
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Otherwise, wait and retry
      const delay = calculateDelay(attempt, initialDelay, maxDelay, backoffMultiplier);
      console.log(`[NetworkUtils] Request failed: ${error.message}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
      await sleep(delay);
    }
  }
  
  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Request failed after all retries');
}

