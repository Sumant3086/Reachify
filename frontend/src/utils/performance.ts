// Performance monitoring utilities

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 100;

  mark(name: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.recordMetric(name, duration);
      
      // Warn on slow operations
      if (duration > 1000) {
        console.warn(`Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
      }
    };
  }

  private recordMetric(name: string, duration: number): void {
    this.metrics.push({
      name,
      duration,
      timestamp: Date.now()
    });

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  getAverageTime(name: string): number {
    const filtered = this.metrics.filter(m => m.name === name);
    if (filtered.length === 0) return 0;
    
    const sum = filtered.reduce((acc, m) => acc + m.duration, 0);
    return sum / filtered.length;
  }

  clear(): void {
    this.metrics = [];
  }
}

export const performanceMonitor = new PerformanceMonitor();

// React hook for performance tracking
export function usePerformanceTracking(componentName: string) {
  const endMark = performanceMonitor.mark(`${componentName}:render`);
  
  return () => {
    endMark();
  };
}

// Track API calls
export function trackApiCall(endpoint: string): () => void {
  return performanceMonitor.mark(`api:${endpoint}`);
}

// Get Web Vitals
export function getWebVitals() {
  if (!('performance' in window)) return null;

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  
  return {
    // Time to First Byte
    ttfb: navigation?.responseStart - navigation?.requestStart,
    // DOM Content Loaded
    dcl: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart,
    // Load Complete
    loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart,
    // First Paint
    fp: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
    // First Contentful Paint
    fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
  };
}
