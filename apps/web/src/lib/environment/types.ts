export interface IEnvironment {
  getOrigin(): string;
  getCurrentUrl(): string;
  redirect(url: string): void;
  reload(): void;
  getQueryParams(): Record<string, string>;
  getHashParams(): Record<string, string>;
  clearHash(): void;
}

