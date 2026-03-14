/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Performance monitoring utility for tracking slow queries and operations
 */

interface PerformanceMetrics {
  operation: string;
  duration: number;
  timestamp: Date;
  metadata?: any;
}

export class PerformanceMonitor {
  private static metrics: PerformanceMetrics[] = [];
  private static readonly MAX_METRICS = 1000; // Keep last 1000 metrics
  
  /**
   * Track a database query or operation performance
   */
  static async trackQuery<T>(
    name: string,
    fn: () => Promise<T>,
    warnThreshold = 100,
    metadata?: any
  ): Promise<T> {
    const start = performance.now();
    
    try {
      const result = await fn();
      const duration = performance.now() - start;
      
      // Log slow queries
      if (duration > warnThreshold) {
        console.warn(`⚠️ Slow query: ${name} took ${duration.toFixed(2)}ms`, metadata);
      }
      
      // Store metrics
      this.addMetric({
        operation: name,
        duration,
        timestamp: new Date(),
        metadata
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`❌ Query failed: ${name} after ${duration.toFixed(2)}ms`, error);
      
      // Store failed operation metrics
      this.addMetric({
        operation: `${name}_FAILED`,
        duration,
        timestamp: new Date(),
        metadata: { error: error instanceof Error ? error.message : 'Unknown error', ...metadata }
      });
      
      throw error;
    }
  }

  /**
   * Track synchronous operations
   */
  static trackSync<T>(
    name: string,
    fn: () => T,
    warnThreshold = 50,
    metadata?: any
  ): T {
    const start = performance.now();
    
    try {
      const result = fn();
      const duration = performance.now() - start;
      
      if (duration > warnThreshold) {
        console.warn(`⚠️ Slow operation: ${name} took ${duration.toFixed(2)}ms`, metadata);
      }
      
      this.addMetric({
        operation: name,
        duration,
        timestamp: new Date(),
        metadata
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`❌ Operation failed: ${name} after ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  }

  /**
   * Add a performance metric
   */
  private static addMetric(metric: PerformanceMetrics) {
    this.metrics.push(metric);
    
    // Keep only the last MAX_METRICS entries
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }
  }

  /**
   * Get performance statistics
   */
  static getStats(operation?: string, lastMinutes = 60) {
    const cutoff = new Date(Date.now() - lastMinutes * 60 * 1000);
    
    let filteredMetrics = this.metrics.filter(m => m.timestamp >= cutoff);
    
    if (operation) {
      filteredMetrics = filteredMetrics.filter(m => m.operation.includes(operation));
    }

    if (filteredMetrics.length === 0) {
      return {
        count: 0,
        avgDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        slowQueries: []
      };
    }

    const durations = filteredMetrics.map(m => m.duration);
    const slowQueries = filteredMetrics
      .filter(m => m.duration > 100)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    return {
      count: filteredMetrics.length,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      slowQueries: slowQueries.map(m => ({
        operation: m.operation,
        duration: m.duration,
        timestamp: m.timestamp,
        metadata: m.metadata
      }))
    };
  }

  /**
   * Get top slow operations
   */
  static getSlowOperations(limit = 10, lastMinutes = 60) {
    const cutoff = new Date(Date.now() - lastMinutes * 60 * 1000);
    
    return this.metrics
      .filter(m => m.timestamp >= cutoff)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit)
      .map(m => ({
        operation: m.operation,
        duration: m.duration,
        timestamp: m.timestamp,
        metadata: m.metadata
      }));
  }

  /**
   * Clear all metrics
   */
  static clearMetrics() {
    this.metrics = [];
  }

  /**
   * Log performance summary
   */
  static logSummary(lastMinutes = 60) {
    const stats = this.getStats(undefined, lastMinutes);
    const slowOps = this.getSlowOperations(5, lastMinutes);

    console.log(`📊 Performance Summary (last ${lastMinutes} minutes):`);
    console.log(`  Total operations: ${stats.count}`);
    console.log(`  Average duration: ${stats.avgDuration.toFixed(2)}ms`);
    console.log(`  Max duration: ${stats.maxDuration.toFixed(2)}ms`);
    console.log(`  Slow queries (>100ms): ${stats.slowQueries.length}`);

    if (slowOps.length > 0) {
      console.log(`  Top slow operations:`);
      slowOps.forEach((op, i) => {
        console.log(`    ${i + 1}. ${op.operation}: ${op.duration.toFixed(2)}ms`);
      });
    }
  }
}

/**
 * Middleware to track API endpoint performance
 */
export function performanceMiddleware(req: any, res: any, next: any) {
  const start = performance.now();
  const originalSend = res.send;

  res.send = function(data: any) {
    const duration = performance.now() - start;
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    
    // Log slow API calls
    if (duration > 500) {
      console.warn(`⚠️ Slow API: ${endpoint} took ${duration.toFixed(2)}ms`);
    }

    // Store API performance metrics
    PerformanceMonitor['addMetric']({
      operation: `API_${endpoint}`,
      duration,
      timestamp: new Date(),
      metadata: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent')
      }
    });

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Database query wrapper with automatic performance tracking
 */
export function trackPrismaQuery<T>(
  queryName: string,
  query: () => Promise<T>,
  metadata?: any
): Promise<T> {
  return PerformanceMonitor.trackQuery(
    `DB_${queryName}`,
    query,
    100, // Warn if DB query > 100ms
    metadata
  );
}

/**
 * Background job performance tracker
 */
export function trackJobPerformance<T>(
  jobName: string,
  job: () => Promise<T>,
  metadata?: any
): Promise<T> {
  return PerformanceMonitor.trackQuery(
    `JOB_${jobName}`,
    job,
    1000, // Warn if job > 1 second
    metadata
  );
}