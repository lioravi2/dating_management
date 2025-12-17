'use client';

import { useRouter, usePathname, useSearchParams as useNextSearchParams } from 'next/navigation';
import { createContext, useContext, ReactNode } from 'react';
import Link from 'next/link';
import { INavigation, NavigationParams, ILinkProps } from './types';

class WebNavigation implements INavigation {
  constructor(
    private router: ReturnType<typeof useRouter>,
    private pathname: string,
    private searchParams: URLSearchParams
  ) {}

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
    const current = new URLSearchParams(this.searchParams);
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined) {
        current.delete(key);
      } else {
        current.set(key, String(value));
      }
    });
    const newPath = `${this.pathname}?${current.toString()}`;
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
    return `${path}?${searchParams.toString()}`;
  }
}

const NavigationContext = createContext<INavigation | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useNextSearchParams();
  
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

