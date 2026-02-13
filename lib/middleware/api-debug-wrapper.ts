import type { NextApiRequest, NextApiResponse } from 'next';

interface DebugResponseData {
  timings: {
    [key: string]: number;
  };
  memory?: {
    heapUsed: string;
    heapTotal: string;
    external: string;
  };
  responseSize: number;
  processingTime: number;
}

class DebugResponseWrapper {
  private startTime: number;
  private checkpoints: Map<string, number>;
  private readonly originalResponse: NextApiResponse;
  private debugData: DebugResponseData;
  
  constructor(res: NextApiResponse) {
    this.startTime = Date.now();
    this.checkpoints = new Map();
    this.originalResponse = res;
    this.debugData = {
      timings: {},
      responseSize: 0,
      processingTime: 0
    };
    this.addCheckpoint('init');
  }

  private addCheckpoint(name: string) {
    const timestamp = Date.now() - this.startTime;
    this.checkpoints.set(name, timestamp);
    this.debugData.timings[name] = timestamp;
    console.debug(`[Debug] Checkpoint ${name}: ${timestamp}ms`);
  }

  private async getMemoryUsage() {
    if (typeof process !== 'undefined') {
      const usage = process.memoryUsage();
      return {
        heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(usage.external / 1024 / 1024)}MB`
      };
    }
    return undefined;
  }

  private findLargeObjects(obj: any, path: string = 'root', threshold: number = 1000): string[] {
    const large: string[] = [];
    
    const check = (value: any, currentPath: string) => {
      if (typeof value === 'object' && value !== null) {
        const size = new TextEncoder().encode(JSON.stringify(value)).length;
        if (size > threshold) {
          large.push(`${currentPath} (${size} bytes)`);
        }
        
        Object.entries(value).forEach(([key, val]) => {
          check(val, `${currentPath}.${key}`);
        });
      }
    };
    
    check(obj, path);
    return large;
  }

  async json(data: any) {
    this.addCheckpoint('response_start');
    
    try {
      // Calculate response size
      const responseString = JSON.stringify(data);
      const size = new TextEncoder().encode(responseString).length;
      this.debugData.responseSize = size;
      
      // Check for large objects
      const largeObjects = this.findLargeObjects(data);
      if (largeObjects.length > 0) {
        console.warn('[Debug] Large objects found:', largeObjects);
      }

      // Get memory usage
      const memoryUsage = await this.getMemoryUsage();
      if (memoryUsage) {
        this.debugData.memory = memoryUsage;
      }

      // Set debug headers
      this.originalResponse.setHeader('X-Debug-Response-Size', size);
      this.originalResponse.setHeader('X-Debug-Processing-Time', Date.now() - this.startTime);
      this.originalResponse.setHeader('X-Debug-Checkpoints', JSON.stringify(Object.fromEntries(this.checkpoints)));

      // Handle large responses
      if (size > 1024 * 1024) { // 1MB
        console.warn('[Debug] Large response detected:', {
          size: `${Math.round(size / 1024 / 1024)}MB`,
          checkpoints: Object.fromEntries(this.checkpoints)
        });
      }

      this.addCheckpoint('pre_send');
      
      // Add debug info to response
      const responseWithDebug = {
        data,
        _debug: this.debugData
      };

      // Send response
      await new Promise<void>((resolve) => {
        this.originalResponse.json(responseWithDebug);
        resolve();
      });

      this.addCheckpoint('response_complete');
      this.debugData.processingTime = Date.now() - this.startTime;
      
      console.debug('[Debug] Response complete:', {
        size: `${Math.round(size / 1024)}KB`,
        processingTime: this.debugData.processingTime,
        checkpoints: Object.fromEntries(this.checkpoints)
      });
      
    } catch (error) {
      this.addCheckpoint('response_error');
      console.error('[Debug] Error sending response:', error);
      throw error;
    }
  }
}

export function createDebugMiddleware() {
  return async function debugMiddleware(
    req: NextApiRequest,
    res: NextApiResponse,
    next: () => Promise<void>
  ) {
    console.debug('[Debug] Request received:', {
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString()
    });

    const debugRes = new DebugResponseWrapper(res);
    
    // Replace response object with wrapped version
    Object.defineProperty(req, 'res', {
      value: debugRes,
      writable: true,
      configurable: true
    });
    
    try {
      await next();
    } catch (error) {
      console.error('[Debug] Middleware caught error:', error);
      throw error;
    }
  };
}

export const debugMiddleware = createDebugMiddleware();