// src/resource/ResourceManager.ts

import { EventEmitter } from 'events';

// Resource Types and Interfaces
interface ResourceQuota {
  cpu: number;      // CPU cores
  memory: number;   // Memory in MB
  storage: number;  // Storage in GB
  requests: number; // Requests per minute
}

interface ResourceUsage {
  cpu: number;
  memory: number;
  storage: number;
  requests: number;
  timestamp: Date;
}

interface ResourceAllocation {
  serviceId: string;
  quota: ResourceQuota;
  usage: ResourceUsage;
  priority: 'low' | 'medium' | 'high';
}

interface ScalingPolicy {
  metric: keyof ResourceQuota;
  threshold: number;
  action: 'scale-up' | 'scale-down';
  magnitude: number;
}

class ResourceManager {
  private static instance: ResourceManager;
  private allocations: Map<string, ResourceAllocation>;
  private policies: Map<string, ScalingPolicy[]>;
  private eventEmitter: EventEmitter;
  private totalResources: ResourceQuota;

  private constructor() {
    this.allocations = new Map();
    this.policies = new Map();
    this.eventEmitter = new EventEmitter();
    
    // Initialize with default total resources
    this.totalResources = {
      cpu: 100,      // 100 cores
      memory: 512000, // 512 GB
      storage: 10000, // 10 TB
      requests: 10000 // 10k requests per minute
    };

    this.startResourceMonitoring();
  }

  public static getInstance(): ResourceManager {
    if (!ResourceManager.instance) {
      ResourceManager.instance = new ResourceManager();
    }
    return ResourceManager.instance;
  }

  // Resource Allocation
  public async allocateResources(
    serviceId: string,
    requestedQuota: ResourceQuota,
    priority: 'low' | 'medium' | 'high'
  ): Promise<void> {
    // Check if resources are available
    if (!this.canAllocateResources(requestedQuota)) {
      throw new Error('Insufficient resources available');
    }

    const allocation: ResourceAllocation = {
      serviceId,
      quota: requestedQuota,
      usage: {
        cpu: 0,
        memory: 0,
        storage: 0,
        requests: 0,
        timestamp: new Date()
      },
      priority
    };

    this.allocations.set(serviceId, allocation);
    this.eventEmitter.emit('resourceAllocated', allocation);
  }

  // Resource Deallocation
  public async deallocateResources(serviceId: string): Promise<void> {
    const allocation = this.allocations.get(serviceId);
    if (!allocation) {
      throw new Error(`No allocation found for service: ${serviceId}`);
    }

    this.allocations.delete(serviceId);
    this.eventEmitter.emit('resourceDeallocated', allocation);
  }

  // Resource Usage Tracking
  public updateResourceUsage(serviceId: string, usage: Partial<ResourceUsage>): void {
    const allocation = this.allocations.get(serviceId);
    if (!allocation) {
      throw new Error(`No allocation found for service: ${serviceId}`);
    }

    const updatedUsage: ResourceUsage = {
      ...allocation.usage,
      ...usage,
      timestamp: new Date()
    };

    allocation.usage = updatedUsage;
    this.allocations.set(serviceId, allocation);

    // Check scaling policies
    this.evaluateScalingPolicies(serviceId);
  }

  // Scaling Policy Management
  public addScalingPolicy(serviceId: string, policy: ScalingPolicy): void {
    const policies = this.policies.get(serviceId) || [];
    policies.push(policy);
    this.policies.set(serviceId, policies);
  }

  // Resource Optimization
  public async optimizeResources(): Promise<void> {
    // Get all allocations sorted by priority
    const sortedAllocations = Array.from(this.allocations.values())
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });

    // Calculate total usage
    const totalUsage = this.calculateTotalUsage();

    // If we're over capacity, start reducing allocations from lowest priority
    if (this.isOverCapacity(totalUsage)) {
      for (const allocation of sortedAllocations.reverse()) {
        const reduction = this.calculateRequiredReduction(allocation);
        if (reduction) {
          await this.reduceAllocation(allocation.serviceId, reduction);
        }
      }
    }
  }

  // Monitoring and Alerts
  private startResourceMonitoring(): void {
    setInterval(() => {
      const usage = this.calculateTotalUsage();
      this.eventEmitter.emit('resourceUsageUpdated', usage);

      // Check for resource pressure
      if (this.isResourcePressure(usage)) {
        this.eventEmitter.emit('resourcePressure', usage);
      }
    }, 60000); // Monitor every minute
  }

  // Resource Analysis
  public generateResourceReport(): Record<string, any> {
    const totalUsage = this.calculateTotalUsage();
    const utilizationRates = this.calculateUtilizationRates(totalUsage);
    const serviceMetrics = this.calculateServiceMetrics();

    return {
      totalResources: this.totalResources,
      totalUsage,
      utilizationRates,
      serviceMetrics,
      pressure: this.isResourcePressure(totalUsage)
    };
  }

  // Private Helper Methods
  private canAllocateResources(requested: ResourceQuota): boolean {
    const currentUsage = this.calculateTotalUsage();
    return Object.keys(requested).every(key => {
      const resourceKey = key as keyof ResourceQuota;
      return currentUsage[resourceKey] + requested[resourceKey] <= this.totalResources[resourceKey];
    });
  }

  private calculateTotalUsage(): ResourceUsage {
    const initial: ResourceUsage = {
      cpu: 0,
      memory: 0,
      storage: 0,
      requests: 0,
      timestamp: new Date()
    };

    return Array.from(this.allocations.values()).reduce((total, allocation) => ({
      cpu: total.cpu + allocation.usage.cpu,
      memory: total.memory + allocation.usage.memory,
      storage: total.storage + allocation.usage.storage,
      requests: total.requests + allocation.usage.requests,
      timestamp: new Date()
    }), initial);
  }

  private isOverCapacity(usage: ResourceUsage): boolean {
    return Object.keys(usage).some(key => {
      const resourceKey = key as keyof ResourceQuota;
      return usage[resourceKey] > this.totalResources[resourceKey];
    });
  }

  private calculateRequiredReduction(allocation: ResourceAllocation): Partial<ResourceQuota> | null {
    const currentUsage = this.calculateTotalUsage();
    const reduction: Partial<ResourceQuota> = {};
    let needsReduction = false;

    Object.keys(currentUsage).forEach(key => {
      const resourceKey = key as keyof ResourceQuota;
      if (currentUsage[resourceKey] > this.totalResources[resourceKey]) {
        reduction[resourceKey] = Math.min(
          allocation.quota[resourceKey],
          currentUsage[resourceKey] - this.totalResources[resourceKey]
        );
        needsReduction = true;
      }
    });

    return needsReduction ? reduction : null;
  }

  private async reduceAllocation(
    serviceId: string,
    reduction: Partial<ResourceQuota>
  ): Promise<void> {
    const allocation = this.allocations.get(serviceId);
    if (!allocation) return;

    const newQuota: ResourceQuota = {
      ...allocation.quota,
      ...Object.keys(reduction).reduce((acc, key) => {
        const resourceKey = key as keyof ResourceQuota;
        acc[resourceKey] = Math.max(0, allocation.quota[resourceKey] - (reduction[resourceKey] || 0));
        return acc;
      }, {} as ResourceQuota)
    };

    allocation.quota = newQuota;
    this.allocations.set(serviceId, allocation);
    this.eventEmitter.emit('allocationReduced', { serviceId, newQuota });
  }

  private evaluateScalingPolicies(serviceId: string): void {
    const allocation = this.allocations.get(serviceId);
    const policies = this.policies.get(serviceId);
    if (!allocation || !policies) return;

    for (const policy of policies) {
      const currentValue = allocation.usage[policy.metric];
      const thresholdValue = allocation.quota[policy.metric] * policy.threshold;

      if (policy.action === 'scale-up' && currentValue > thresholdValue) {
        this.handleScaleUp(serviceId, policy);
      } else if (policy.action === 'scale-down' && currentValue < thresholdValue) {
        this.handleScaleDown(serviceId, policy);
      }
    }
  }

  private async handleScaleUp(serviceId: string, policy: ScalingPolicy): Promise<void> {
    const allocation = this.allocations.get(serviceId);
    if (!allocation) return;

    const increase = allocation.quota[policy.metric] * policy.magnitude;
    const newQuota = { ...allocation.quota };
    newQuota[policy.metric] += increase;

    if (this.canAllocateResources(newQuota)) {
      allocation.quota = newQuota;
      this.allocations.set(serviceId, allocation);
      this.eventEmitter.emit('scaledUp', { serviceId, policy, newQuota });
    }
  }

  private async handleScaleDown(serviceId: string, policy: ScalingPolicy): Promise<void> {
    const allocation = this.allocations.get(serviceId);
    if (!allocation) return;

    const decrease = allocation.quota[policy.metric] * policy.magnitude;
    const newQuota = { ...allocation.quota };
    newQuota[policy.metric] = Math.max(0, newQuota[policy.metric] - decrease);

    allocation.quota = newQuota;
    this.allocations.set(serviceId, allocation);
    this.eventEmitter.emit('scaledDown', { serviceId, policy, newQuota });
  }

  private isResourcePressure(usage: ResourceUsage): boolean {
    const PRESSURE_THRESHOLD = 0.85; // 85% utilization
    return Object.keys(usage).some(key => {
      const resourceKey = key as keyof ResourceQuota;
      return usage[resourceKey] / this.totalResources[resourceKey] > PRESSURE_THRESHOLD;
    });
  }

  private calculateUtilizationRates(usage: ResourceUsage): Record<string, number> {
    return Object.keys(usage).reduce((rates, key) => {
      const resourceKey = key as keyof ResourceQuota;
      rates[key] = usage[resourceKey] / this.totalResources[resourceKey];
      return rates;
    }, {} as Record<string, number>);
  }

  private calculateServiceMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    
    this.allocations.forEach((allocation, serviceId) => {
      metrics[serviceId] = {
        utilizationRates: {
          cpu: allocation.usage.cpu / allocation.quota.cpu,
          memory: allocation.usage.memory / allocation.quota.memory,
          storage: allocation.usage.storage / allocation.quota.storage,
          requests: allocation.usage.requests / allocation.quota.requests
        },
        quota: allocation.quota,
        usage: allocation.usage,
        priority: allocation.priority
      };
    });

    return metrics;
  }
}

export default ResourceManager;