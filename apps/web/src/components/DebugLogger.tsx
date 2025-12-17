'use client';

import { useEffect } from 'react';

const SERVER_ENDPOINT = 'http://127.0.0.1:7242/ingest/9fdef7ce-e7de-4bc0-af40-30ebb2c95ac0';

function log(hypothesisId: string, location: string, message: string, data: any) {
  const payload = {
    sessionId: 'debug-session',
    runId: 'run1',
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now()
  };
  
  fetch(SERVER_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

export default function DebugLogger() {
  useEffect(() => {
    // #region agent log
    log('F', 'DebugLogger.tsx:25', 'DebugLogger mounted', { windowLocation: window.location.href });
    // #endregion
    
    // Monitor resource loading errors
    const handleError = (e: ErrorEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'LINK' || target.tagName === 'SCRIPT')) {
        // #region agent log
        log('F', 'DebugLogger.tsx:32', 'Resource load error detected', {
          tag: target.tagName,
          src: (target as HTMLScriptElement).src || (target as HTMLLinkElement).href,
          error: e.message,
          filename: e.filename,
          lineno: e.lineno,
          colno: e.colno
        });
        // #endregion
      }
    };
    
    // Monitor failed network requests
    const handleResourceError = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'LINK' || target.tagName === 'SCRIPT' || target.tagName === 'IMG')) {
        // #region agent log
        log('F', 'DebugLogger.tsx:46', 'Resource failed to load', {
          tag: target.tagName,
          src: (target as HTMLScriptElement).src || (target as HTMLLinkElement).href || (target as HTMLImageElement).src
        });
        // #endregion
      }
    };
    
    window.addEventListener('error', handleError, true);
    window.addEventListener('error', handleResourceError, true);
    
    return () => {
      window.removeEventListener('error', handleError, true);
      window.removeEventListener('error', handleResourceError, true);
    };
  }, []);
  
  return null;
}

