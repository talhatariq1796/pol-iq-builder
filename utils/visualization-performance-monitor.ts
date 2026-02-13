/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * VisualizationManager Performance Monitor
 * 
 * Provides real-time monitoring and diagnostics for VisualizationManager
 * operations to help identify and prevent timeout issues.
 */

export interface PerformanceMetrics {
  totalOperations: number;
  successfulOperations: number;
  timeoutErrors: number;
  averageCompletionTime: number;
  activeOperations: number;
  lastActivity: number;
  queueSize: number;
  lockContention: number;
  memoryUsage?: {
    inFlightPromises: number;
    queuedOperations: number;
    activeTimers: number;
  };
}

export interface OperationDiagnostics {
  signature: string;
  callerId: string;
  startTime: number;
  recordCount: number;
  geometryType: string;
  isComplexOperation: boolean;
  timeoutThreshold: number;
  estimatedCompletion?: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export class VisualizationPerformanceMonitor {
  private static instance: VisualizationPerformanceMonitor;
  private operationHistory: OperationDiagnostics[] = [];
  private activeOperations: Map<string, OperationDiagnostics> = new Map();
  private performanceThresholds = {
    timeoutWarning: 20000, // 20s
    timeoutCritical: 30000, // 30s
    maxConcurrentOps: 3,
    maxQueueSize: 10,
    memoryLeakThreshold: 100
  };

  private constructor() {
    // Start background monitoring
    this.startBackgroundMonitoring();
  }

  public static getInstance(): VisualizationPerformanceMonitor {
    if (!VisualizationPerformanceMonitor.instance) {
      VisualizationPerformanceMonitor.instance = new VisualizationPerformanceMonitor();
    }
    return VisualizationPerformanceMonitor.instance;
  }

  /**
   * Register the start of a visualization operation
   */
  public registerOperationStart(
    signature: string,
    callerId: string,
    recordCount: number,
    geometryType: string,
    timeoutThreshold: number
  ): void {
    const diagnostics: OperationDiagnostics = {
      signature: signature.substring(0, 50) + '...',
      callerId,
      startTime: Date.now(),
      recordCount,
      geometryType,
      isComplexOperation: this.isComplexOperation(recordCount, callerId),
      timeoutThreshold,
      riskLevel: this.calculateRiskLevel(recordCount, callerId, timeoutThreshold)
    };

    this.activeOperations.set(signature, diagnostics);
    this.operationHistory.push(diagnostics);

    // Keep history manageable
    if (this.operationHistory.length > 100) {
      this.operationHistory = this.operationHistory.slice(-50);
    }

    console.log('[VisualizationMonitor] Operation started:', diagnostics);
  }

  /**
   * Register the completion of a visualization operation
   */
  public registerOperationComplete(
    signature: string,
    success: boolean,
    error?: Error
  ): void {
    const diagnostics = this.activeOperations.get(signature);
    if (!diagnostics) return;

    const duration = Date.now() - diagnostics.startTime;
    diagnostics.estimatedCompletion = duration;

    this.activeOperations.delete(signature);

    const logLevel = success ? 'log' : 'error';
    console[logLevel]('[VisualizationMonitor] Operation completed:', {
      signature: diagnostics.signature,
      callerId: diagnostics.callerId,
      duration,
      success,
      error: error?.message,
      riskLevel: diagnostics.riskLevel
    });

    // Alert on slow operations
    if (duration > this.performanceThresholds.timeoutWarning) {
      console.warn('[VisualizationMonitor] Slow operation detected:', {
        signature: diagnostics.signature,
        duration,
        threshold: this.performanceThresholds.timeoutWarning
      });
    }
  }

  /**
   * Get current performance metrics from VisualizationManager
   */
  public getPerformanceMetrics(mapView?: any): PerformanceMetrics {
    let managerMetrics: PerformanceMetrics = {
      totalOperations: 0,
      successfulOperations: 0,
      timeoutErrors: 0,
      averageCompletionTime: 0,
      activeOperations: this.activeOperations.size,
      lastActivity: Date.now(),
      queueSize: 0,
      lockContention: 0
    };

    // Try to get metrics from actual VisualizationManager if available
    if (mapView?.map?.__visualizationManager?.__metrics) {
      const vmMetrics = mapView.map.__visualizationManager.__metrics;
      managerMetrics = {
        ...managerMetrics,
        totalOperations: vmMetrics.totalOperations || 0,
        successfulOperations: vmMetrics.successfulOperations || 0,
        timeoutErrors: vmMetrics.timeoutErrors || 0,
        averageCompletionTime: vmMetrics.averageCompletionTime || 0,
        queueSize: mapView.map.__visualizationManager.__operationQueue?.length || 0,
        memoryUsage: {
          inFlightPromises: mapView.map.__visualizationManager.inFlight ? 1 : 0,
          queuedOperations: mapView.map.__visualizationManager.__operationQueue?.length || 0,
          activeTimers: mapView.map.__visualizationManager.__inFlightTimer ? 1 : 0
        }
      };
    }

    return managerMetrics;
  }

  /**
   * Generate diagnostic report
   */
  public generateDiagnosticReport(mapView?: any): string {
    const metrics = this.getPerformanceMetrics(mapView);
    const activeOps = Array.from(this.activeOperations.values());
    const recentOps = this.operationHistory.slice(-10);

    const report = `
=== VisualizationManager Diagnostic Report ===
Generated: ${new Date().toISOString()}

Performance Metrics:
- Total Operations: ${metrics.totalOperations}
- Successful Operations: ${metrics.successfulOperations}
- Timeout Errors: ${metrics.timeoutErrors}
- Success Rate: ${metrics.totalOperations > 0 ? ((metrics.successfulOperations / metrics.totalOperations) * 100).toFixed(1) : 0}%
- Average Completion Time: ${metrics.averageCompletionTime.toFixed(0)}ms
- Active Operations: ${metrics.activeOperations}
- Queue Size: ${metrics.queueSize}

Memory Usage:
- In-Flight Promises: ${metrics.memoryUsage?.inFlightPromises || 0}
- Queued Operations: ${metrics.memoryUsage?.queuedOperations || 0}
- Active Timers: ${metrics.memoryUsage?.activeTimers || 0}

Currently Active Operations:
${activeOps.map(op => 
  `- ${op.callerId} (${Date.now() - op.startTime}ms) [${op.riskLevel}]`
).join('\n') || 'None'}

Recent Operations (last 10):
${recentOps.map(op => 
  `- ${op.callerId}: ${op.estimatedCompletion || 'incomplete'}ms [${op.riskLevel}]`
).join('\n') || 'None'}

Health Status: ${this.getHealthStatus(metrics)}
Recommendations: ${this.getRecommendations(metrics).join(', ')}
`;

    return report;
  }

  /**
   * Start background monitoring for long-running operations
   */
  private startBackgroundMonitoring(): void {
    setInterval(() => {
      const now = Date.now();
      
      // Check for long-running operations
      this.activeOperations.forEach((diagnostics, signature) => {
        const duration = now - diagnostics.startTime;
        
        if (duration > this.performanceThresholds.timeoutCritical) {
          console.error('[VisualizationMonitor] Critical timeout risk:', {
            signature: diagnostics.signature,
            callerId: diagnostics.callerId,
            duration,
            threshold: this.performanceThresholds.timeoutCritical
          });
        } else if (duration > this.performanceThresholds.timeoutWarning) {
          console.warn('[VisualizationMonitor] Timeout warning:', {
            signature: diagnostics.signature,
            callerId: diagnostics.callerId,
            duration,
            threshold: this.performanceThresholds.timeoutWarning
          });
        }
      });
    }, 5000); // Check every 5 seconds
  }

  private isComplexOperation(recordCount: number, callerId: string): boolean {
    return recordCount > 1000 || 
           callerId.includes('CMA') || 
           callerId.includes('comparative') ||
           callerId.includes('complex');
  }

  private calculateRiskLevel(
    recordCount: number, 
    callerId: string, 
    timeoutThreshold: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    let riskScore = 0;

    // Record count risk
    if (recordCount > 5000) riskScore += 3;
    else if (recordCount > 1000) riskScore += 2;
    else if (recordCount > 500) riskScore += 1;

    // Operation type risk
    if (callerId.includes('CMA') || callerId.includes('comparative')) riskScore += 2;
    if (callerId.includes('complex') || callerId.includes('heavy')) riskScore += 1;

    // Timeout threshold risk
    if (timeoutThreshold > 60000) riskScore += 2;
    else if (timeoutThreshold > 30000) riskScore += 1;

    // Concurrent operations risk
    if (this.activeOperations.size >= this.performanceThresholds.maxConcurrentOps) {
      riskScore += 2;
    }

    if (riskScore >= 6) return 'critical';
    if (riskScore >= 4) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  }

  private getHealthStatus(metrics: PerformanceMetrics): string {
    const successRate = metrics.totalOperations > 0 ? 
      (metrics.successfulOperations / metrics.totalOperations) : 1;
    
    if (successRate < 0.7) return 'CRITICAL';
    if (successRate < 0.9) return 'WARNING';
    if (metrics.activeOperations >= this.performanceThresholds.maxConcurrentOps) return 'WARNING';
    if (metrics.queueSize >= this.performanceThresholds.maxQueueSize) return 'WARNING';
    
    return 'HEALTHY';
  }

  private getRecommendations(metrics: PerformanceMetrics): string[] {
    const recommendations: string[] = [];
    
    if (metrics.timeoutErrors > 3) {
      recommendations.push('Consider increasing TTL values for complex operations');
    }
    
    if (metrics.averageCompletionTime > 15000) {
      recommendations.push('Optimize data processing or reduce record counts');
    }
    
    if (metrics.activeOperations >= this.performanceThresholds.maxConcurrentOps) {
      recommendations.push('Reduce concurrent operations or increase throttling');
    }
    
    if (metrics.queueSize >= this.performanceThresholds.maxQueueSize) {
      recommendations.push('Process queue more aggressively or reject excess requests');
    }
    
    const successRate = metrics.totalOperations > 0 ? 
      (metrics.successfulOperations / metrics.totalOperations) : 1;
    
    if (successRate < 0.8) {
      recommendations.push('Investigate root causes of operation failures');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Performance is within acceptable parameters');
    }
    
    return recommendations;
  }

  /**
   * Export performance data for analysis
   */
  public exportPerformanceData(): any {
    return {
      timestamp: Date.now(),
      operationHistory: this.operationHistory,
      activeOperations: Array.from(this.activeOperations.values()),
      thresholds: this.performanceThresholds
    };
  }

  /**
   * Clear performance history (useful for testing)
   */
  public clearHistory(): void {
    this.operationHistory = [];
    this.activeOperations.clear();
  }
}

// Export singleton instance
export const visualizationMonitor = VisualizationPerformanceMonitor.getInstance();

/**
 * Utility function to integrate monitoring with applyAnalysisEngineVisualization
 */
export function withVisualizationMonitoring<T extends any[]>(
  originalFunction: (...args: T) => Promise<any>
) {
  return async (...args: T): Promise<any> => {
    const [visualization, data, mapView, , , options] = args;
    
    const signature = JSON.stringify({
      field: visualization?.renderer?.field,
      targetVariable: data?.targetVariable,
      recordCount: data?.records?.length || 0
    });
    
    const callerId = options?.callerId || 'unknown';
    const recordCount = data?.records?.length || 0;
    const geometryType = data?.records?.[0]?.geometry?.type || 'unknown';
    const timeoutThreshold = options?.inflightTTLMs || 30000;
    
    visualizationMonitor.registerOperationStart(
      signature,
      callerId,
      recordCount,
      geometryType,
      timeoutThreshold
    );
    
    try {
      const result = await originalFunction(...args);
      visualizationMonitor.registerOperationComplete(signature, true);
      return result;
    } catch (error) {
      visualizationMonitor.registerOperationComplete(signature, false, error as Error);
      throw error;
    }
  };
}