import { lazy, ComponentType } from 'react';

interface LazyLoadOptions {
  delay?: number;
  retries?: number;
}

/**
 * Enhanced lazy loading with retry logic and minimum delay
 */
export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  options: LazyLoadOptions = {}
): React.LazyExoticComponent<T> {
  const { delay = 0, retries = 3 } = options;

  return lazy(() => {
    return new Promise<{ default: T }>((resolve, reject) => {
      const attemptImport = async (attemptsLeft: number) => {
        try {
          const module = await importFunc();
          
          // Add minimum delay for better UX (prevents flash)
          if (delay > 0) {
            await new Promise(r => setTimeout(r, delay));
          }
          
          resolve(module);
        } catch (error) {
          if (attemptsLeft <= 0) {
            reject(error);
            return;
          }
          
          console.warn(`Import failed, retrying... (${attemptsLeft} attempts left)`);
          setTimeout(() => attemptImport(attemptsLeft - 1), 1000);
        }
      };

      attemptImport(retries);
    });
  });
}

/**
 * Preload a lazy component
 */
export function preloadComponent<T extends ComponentType<any>>(
  LazyComponent: React.LazyExoticComponent<T>
): void {
  // @ts-ignore - accessing internal preload method
  if (LazyComponent._payload && LazyComponent._payload._result === null) {
    // @ts-ignore
    LazyComponent._init(LazyComponent._payload);
  }
}
