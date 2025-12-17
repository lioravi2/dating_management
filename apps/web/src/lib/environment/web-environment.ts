import { IEnvironment } from './types';

export class WebEnvironment implements IEnvironment {
  getOrigin(): string {
    if (typeof window === 'undefined') {
      return '';
    }
    return window.location.origin;
  }

  getCurrentUrl(): string {
    if (typeof window === 'undefined') {
      return '';
    }
    return window.location.href;
  }

  redirect(url: string): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.location.href = url;
  }

  reload(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.location.reload();
  }

  getQueryParams(): Record<string, string> {
    if (typeof window === 'undefined') {
      return {};
    }
    const params: Record<string, string> = {};
    new URLSearchParams(window.location.search).forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }

  getHashParams(): Record<string, string> {
    if (typeof window === 'undefined') {
      return {};
    }
    const params: Record<string, string> = {};
    const hash = window.location.hash.substring(1);
    new URLSearchParams(hash).forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }

  clearHash(): void {
    if (typeof window === 'undefined') {
      return;
    }
    window.location.hash = '';
  }
}

