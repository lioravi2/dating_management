export interface NavigationParams {
  [key: string]: string | number | boolean | undefined;
}

export interface INavigation {
  push(path: string, params?: NavigationParams): void;
  replace(path: string, params?: NavigationParams): void;
  goBack(): void;
  canGoBack(): boolean;
  getCurrentPath(): string;
  getParams(): NavigationParams;
  setParams(params: NavigationParams): void;
}

export interface ILinkProps {
  href: string;
  params?: NavigationParams;
  children: React.ReactNode;
  className?: string;
  replace?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

