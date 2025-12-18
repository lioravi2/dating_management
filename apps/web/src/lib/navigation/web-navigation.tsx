'use client';

import { useRouter, usePathname, useSearchParams as useNextSearchParams } from 'next/navigation';
import { createContext, useContext, ReactNode } from 'react';
import Link from 'next/link';
import { INavigation, NavigationParams, ILinkProps } from './types';

class WebNavigation implements INavigation {
  private searchParams: URLSearchParams;

  constructor(
    private router: ReturnType<typeof useRouter>,
    private pathname: string,
    searchParams: URLSearchParams | ReturnType<typeof useNextSearchParams>
  ) {
    // Convert ReadonlyURLSearchParams to URLSearchParams if needed
    this.searchParams = searchParams instanceof URLSearchParams 
      ? searchParams 
      : new URLSearchParams(searchParams.toString());
  }

  push(path: string, params?: NavigationParams): void {
    const url = this.buildUrl(path, params);
    this.router.push(url);
  }

  replace(path: string, params?: NavigationParams): void {
    const url = this.buildUrl(path, params);
    this.router.replace(url);
  }

  goBack(): void {
    this.router.back();
  }

  canGoBack(): boolean {
    // Next.js doesn't have a direct way to check this
    // Could use window.history.length > 1
    return typeof window !== 'undefined' && window.history.length > 1;
  }

  getCurrentPath(): string {
    return this.pathname;
  }

  getParams(): NavigationParams {
    const params: NavigationParams = {};
    this.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }

  setParams(params: NavigationParams): void {
    // Convert ReadonlyURLSearchParams to URLSearchParams by iterating
    const current = new URLSearchParams();
    this.searchParams.forEach((value, key) => {
      current.set(key, value);
    });
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined) {
        current.delete(key);
      } else {
        current.set(key, String(value));
      }
    });
    // Only append query string if there are actual parameters
    const queryString = current.toString();
    const newPath = queryString ? `${this.pathname}?${queryString}` : this.pathname;
    this.router.replace(newPath);
  }

  private buildUrl(path: string, params?: NavigationParams): string {
    if (!params || Object.keys(params).length === 0) {
      return path;
    }
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    });
    // Only append query string if there are actual parameters
    const queryString = searchParams.toString();
    return queryString ? `${path}?${queryString}` : path;
  }
}

const NavigationContext = createContext<INavigation | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const nextSearchParams = useNextSearchParams();
  
  // Convert ReadonlyURLSearchParams to URLSearchParams for compatibility
  // Using toString() is the most reliable way to convert
  const searchParams = new URLSearchParams(nextSearchParams.toString());
  
  const navigation = new WebNavigation(router, pathname, searchParams);

  return (
    <NavigationContext.Provider value={navigation}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): INavigation {
  const navigation = useContext(NavigationContext);
  if (!navigation) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return navigation;
}

export function NavigationLink({ href, params, children, className, replace }: ILinkProps) {
  const navigation = useNavigation();
  
  const handlePress = (e: React.MouseEvent) => {
    e.preventDefault();
    if (replace) {
      navigation.replace(href, params);
    } else {
      navigation.push(href, params);
    }
  };

  return (
    <Link href={href} className={className} onClick={handlePress}>
      {children}
    </Link>
  );
}

