/* eslint-disable @typescript-eslint/no-explicit-any */
import fetch from 'node-fetch';

// Small helper to provide a fetch with timeout using AbortController. This
// avoids using non-standard `timeout` on RequestInit and keeps the public
// API stable while being resilient at runtime.
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const merged = { ...options, signal: controller.signal } as any;
    return await fetch(url, merged);
  } finally {
    clearTimeout(id);
  }
}
import { 
  HealthCheck, 
  HealthCheckResult, 
  MicroserviceValidationResult,
  ValidationError,
  ValidationWarning,
  MicroservicePerformanceMetrics
} from './types';

export class MicroserviceValidator {
  private defaultTimeout: number = 30000; // 30 seconds
  private defaultRetries: number = 3;

  async waitForDeployment(
    serviceUrl: string, 
    timeout: number = 300000 // 5 minutes default
  ): Promise<boolean> {
    const startTime = Date.now();
    const pollInterval = 10000; // 10 seconds
    
    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetchWithTimeout(`${serviceUrl}/health`, { method: 'GET' }, 10000);
        
        if (response.ok) {
          return true;
        }
      } catch {
        // Service not ready yet, continue polling
      }
      
      // Wait before next poll
      await this.sleep(pollInterval);
    }
    
    return false;
  }

  async validateHealth(serviceUrl: string): Promise<HealthCheckResult> {
    const healthCheck: HealthCheck = {
      name: 'Service Health',
      url: '/health',
      method: 'GET',
      expectedStatus: 200,
      timeout: 10000,
      retries: 3
    };

    return await this.runHealthCheck(healthCheck, serviceUrl);
  }

  async validateTargetVariable(
    serviceUrl: string, 
    expectedVariable: string
  ): Promise<boolean> {
    try {
      const response = await fetchWithTimeout(`${serviceUrl}/validate/target-variable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ variable: expectedVariable })
      }, 10000);

      if (response.ok) {
        const result = await response.json();
        return (result as any).valid === true;
      }
      
      return false;
    } catch (error) {
      console.error(`Target variable validation failed: ${error}`);
      return false;
    }
  }

  async validateModelLoading(serviceUrl: string): Promise<{
    success: boolean;
    modelsLoaded: number;
    error?: string;
  }> {
    try {
      const response = await fetchWithTimeout(`${serviceUrl}/models/status`, { method: 'GET' }, 15000);

      if (response.ok) {
        const result = await response.json();
        return {
          success: true,
          modelsLoaded: (result as any).models_loaded || 0
        };
      } else {
        return {
          success: false,
          modelsLoaded: 0,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      return {
        success: false,
        modelsLoaded: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async testDataIntegration(
    serviceUrl: string, 
    testQueries: string[] = ['test analysis query']
  ): Promise<{
    success: boolean;
    results: Array<{
      query: string;
      success: boolean;
      responseTime: number;
      error?: string;
    }>;
  }> {
    const results = [];
    let overallSuccess = true;

    for (const query of testQueries) {
      const startTime = Date.now();
      
      try {
        const response = await fetchWithTimeout(`${serviceUrl}/process/test`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query,
            endpoint: '/strategic-analysis'
          })
        }, 20000);

        const responseTime = Date.now() - startTime;

        if (response.ok) {
          results.push({
            query,
            success: true,
            responseTime
          });
        } else {
          overallSuccess = false;
          results.push({
            query,
            success: false,
            responseTime,
            error: `HTTP ${response.status}: ${response.statusText}`
          });
        }
      } catch (error) {
        overallSuccess = false;
        const responseTime = Date.now() - startTime;
        results.push({
          query,
          success: false,
          responseTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      success: overallSuccess,
      results
    };
  }

  async runHealthCheck(
    healthCheck: HealthCheck, 
    baseUrl: string
  ): Promise<HealthCheckResult> {
    const fullUrl = baseUrl.endsWith('/') 
      ? baseUrl.slice(0, -1) + healthCheck.url
      : baseUrl + healthCheck.url;

    let lastError: string | undefined;
    
    for (let attempt = 1; attempt <= (healthCheck.retries || this.defaultRetries); attempt++) {
      const startTime = Date.now();
      
      try {
        const requestOptions: any = {
          method: healthCheck.method,
          // We'll pass the timeout separately to fetchWithTimeout below
        };

        // Add headers if specified
        if (healthCheck.headers) {
          requestOptions.headers = healthCheck.headers;
        }

        // Add body for POST requests
        if (healthCheck.method === 'POST' && healthCheck.body) {
          requestOptions.body = JSON.stringify(healthCheck.body);
          if (!requestOptions.headers) {
            requestOptions.headers = {};
          }
          if (!requestOptions.headers['Content-Type']) {
            requestOptions.headers['Content-Type'] = 'application/json';
          }
        }

  const response = await fetchWithTimeout(fullUrl, requestOptions, healthCheck.timeout || this.defaultTimeout);
        const responseTime = Date.now() - startTime;

        // Check if status code matches expected
        if (response.status === healthCheck.expectedStatus) {
          let responseData;
          try {
            responseData = await response.json();
          } catch {
            responseData = await response.text();
          }

          return {
            check: healthCheck,
            success: true,
            responseTime,
            statusCode: response.status,
            response: responseData,
            timestamp: new Date()
          };
        } else {
          lastError = `Expected status ${healthCheck.expectedStatus}, got ${response.status}`;
          
          // If this was the last attempt, return failure
          if (attempt === (healthCheck.retries || this.defaultRetries)) {
            return {
              check: healthCheck,
              success: false,
              responseTime,
              statusCode: response.status,
              error: lastError,
              timestamp: new Date()
            };
          }
        }
      } catch (error) {
        const responseTime = Date.now() - startTime;
        lastError = error instanceof Error ? error.message : 'Unknown error';
        
        // If this was the last attempt, return failure
        if (attempt === (healthCheck.retries || this.defaultRetries)) {
          return {
            check: healthCheck,
            success: false,
            responseTime,
            error: lastError,
            timestamp: new Date()
          };
        }
      }

      // Wait before retry (exponential backoff)
      if (attempt < (healthCheck.retries || this.defaultRetries)) {
        await this.sleep(Math.min(1000 * Math.pow(2, attempt - 1), 10000));
      }
    }

    // This shouldn't be reached, but just in case
    return {
      check: healthCheck,
      success: false,
      responseTime: 0,
      error: lastError || 'Unknown error',
      timestamp: new Date()
    };
  }

  async comprehensiveValidation(
    serviceUrl: string,
    expectedTargetVariable: string,
    testQueries: string[] = []
  ): Promise<MicroserviceValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const startTime = Date.now();

    try {
      // 1. Basic health check
      const healthResult = await this.validateHealth(serviceUrl);
      const serviceHealth = healthResult.success;

      if (!serviceHealth) {
        errors.push({
          code: 'SERVICE_UNHEALTHY',
          message: `Service health check failed: ${healthResult.error}`,
          severity: 'critical'
        });
      }

      // 2. Target variable validation
      const targetVariableValid = await this.validateTargetVariable(serviceUrl, expectedTargetVariable);
      
      if (!targetVariableValid) {
        errors.push({
          code: 'TARGET_VARIABLE_INVALID',
          message: `Target variable validation failed for: ${expectedTargetVariable}`,
          severity: 'high'
        });
      }

      // 3. Model loading validation
      const modelResult = await this.validateModelLoading(serviceUrl);
      const modelsLoaded = modelResult.success && modelResult.modelsLoaded > 0;
      
      if (!modelsLoaded) {
        if (modelResult.modelsLoaded === 0) {
          warnings.push({
            code: 'NO_MODELS_LOADED',
            message: 'No trained models found - training may be required',
            impact: 'Analysis functionality may be limited'
          });
        } else {
          errors.push({
            code: 'MODEL_LOADING_FAILED',
            message: `Model loading validation failed: ${modelResult.error}`,
            severity: 'high'
          });
        }
      }

      // 4. Endpoint responsiveness
      const endpointsResponding = serviceHealth; // Basic check for now
      
      // 5. Data integration test
      const defaultTestQueries = testQueries.length > 0 ? testQueries : [
        'Show me market analysis data',
        'Test strategic analysis endpoint',
        'Validate data processing pipeline'
      ];
      
      const dataIntegrationResult = await this.testDataIntegration(serviceUrl, defaultTestQueries);
      const dataIntegrationValid = dataIntegrationResult.success;
      
      if (!dataIntegrationValid) {
        const failedQueries = dataIntegrationResult.results
          .filter(r => !r.success)
          .map(r => r.query);
        
        errors.push({
          code: 'DATA_INTEGRATION_FAILED',
          message: `Data integration test failed for queries: ${failedQueries.join(', ')}`,
          severity: 'medium'
        });
      }

      // 6. Performance metrics
      const performanceMetrics = this.calculatePerformanceMetrics(
        healthResult,
        dataIntegrationResult.results
      );

      // Add performance warnings if needed
      if (performanceMetrics.responseTime > 5000) {
        warnings.push({
          code: 'SLOW_RESPONSE_TIME',
          message: `Average response time is high: ${performanceMetrics.responseTime}ms`,
          impact: 'User experience may be degraded'
        });
      }

      if (performanceMetrics.errorRate > 0.1) {
        warnings.push({
          code: 'HIGH_ERROR_RATE',
          message: `Error rate is elevated: ${(performanceMetrics.errorRate * 100).toFixed(1)}%`,
          impact: 'Service reliability may be compromised'
        });
      }

      return {
        success: errors.filter(e => e.severity === 'critical').length === 0,
        serviceHealth,
        targetVariableValid,
        modelsLoaded,
        endpointsResponding,
        dataIntegrationValid,
        errors,
        warnings,
        performanceMetrics
      };

    } catch (error) {
      errors.push({
        code: 'VALIDATION_ERROR',
        message: `Comprehensive validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'critical'
      });

      return {
        success: false,
        serviceHealth: false,
        targetVariableValid: false,
        modelsLoaded: false,
        endpointsResponding: false,
        dataIntegrationValid: false,
        errors,
        warnings,
        performanceMetrics: {
          averageRoutingTime: 0,
          queriesPerSecond: 0,
          memoryUsage: 0,
          errorRate: 1,
          responseTime: 0,
          cpuUsage: 0,
          throughput: 0,
          uptime: Date.now() - startTime,
          diskUsage: 0
        }
      };
    }
  }

  private calculatePerformanceMetrics(
    healthResult: HealthCheckResult,
    testResults: Array<{ success: boolean; responseTime: number }>
  ): MicroservicePerformanceMetrics {
    const allResults = [healthResult, ...testResults.map(r => ({ 
      success: r.success, 
      responseTime: r.responseTime 
    }))];

    const responseTimes = allResults.map(r => r.responseTime);
    const errorCount = allResults.filter(r => !r.success).length;
    
    const avgResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

    const errorRate = allResults.length > 0 
      ? errorCount / allResults.length
      : 0;

    const throughput = avgResponseTime > 0 
      ? 1000 / avgResponseTime // requests per second
      : 0;

    return {
      averageRoutingTime: avgResponseTime,
      queriesPerSecond: throughput,
      memoryUsage: 0, // Would need system metrics
      errorRate,
      responseTime: avgResponseTime,
      cpuUsage: 0, // Would need system metrics
      throughput,
      uptime: Date.now(), // Placeholder
      diskUsage: 0 // Would need system metrics
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async monitorService(
    serviceUrl: string,
    duration: number = 60000, // 1 minute default
    interval: number = 10000   // 10 seconds default
  ): Promise<{
    success: boolean;
    monitoring_duration: number;
    checks_performed: number;
    success_rate: number;
    average_response_time: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    const results: { success: boolean; responseTime: number; error?: string }[] = [];
    const errors: string[] = [];

    while (Date.now() - startTime < duration) {
      const checkStart = Date.now();
      
      try {
        const response = await fetchWithTimeout(`${serviceUrl}/health`, {
          method: 'GET'
        }, 5000);

        const responseTime = Date.now() - checkStart;
        const success = response.ok;

        results.push({ success, responseTime });

        if (!success) {
          errors.push(`Health check failed: HTTP ${response.status}`);
        }
      } catch (error) {
        const responseTime = Date.now() - checkStart;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        results.push({ success: false, responseTime, error: errorMessage });
        errors.push(`Health check error: ${errorMessage}`);
      }

      // Wait for next interval
      await this.sleep(interval);
    }

    const successfulChecks = results.filter(r => r.success).length;
    const successRate = results.length > 0 ? successfulChecks / results.length : 0;
    const avgResponseTime = results.length > 0 
      ? results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
      : 0;

    return {
      success: successRate >= 0.8, // 80% success rate threshold
      monitoring_duration: Date.now() - startTime,
      checks_performed: results.length,
      success_rate: successRate,
      average_response_time: avgResponseTime,
      errors
    };
  }
}