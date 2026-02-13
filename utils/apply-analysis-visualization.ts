/* eslint-disable @typescript-eslint/no-explicit-any */
// Shared utility for applying AnalysisEngine visualization to the map
// This function is used by both geospatial-chat-interface and MapApp

import { VisualizationResult, ProcessedAnalysisData } from '@/lib/analysis/types';
import { resolveAreaName as resolveSharedAreaName } from '@/lib/shared/AreaName';
import Point from '@arcgis/core/geometry/Point';
import Polygon from '@arcgis/core/geometry/Polygon';

// Default TTL for an in-flight visualization creation (ms). Optimized for reliability.
const DEFAULT_INFLIGHT_TTL = 45000; // Increased to 45s for complex CMA operations
const FAST_RETRY_TTL = 15000; // Quick retry for simple operations
const MAX_CONCURRENT_OPERATIONS = 3; // Limit concurrent visualizations

// Performance metrics and monitoring
interface VisualizationMetrics {
  totalOperations: number;
  successfulOperations: number;
  timeoutErrors: number;
  averageCompletionTime: number;
  activeOperations: number;
}

// Enhanced manager interface
interface EnhancedVisualizationManager {
  inFlight: Promise<any> | null;
  lastSignature: string | null;
  lastLayerId: string | null;
  resolve: ((value: any) => void) | null;
  reject: ((error: Error) => void) | null;
  cleanup: (() => void) | null;
  __inFlightTimer: NodeJS.Timeout | null;
  __cleanupAttached: boolean;
  __operationQueue: Array<() => Promise<any>>;
  __activeOperations: number;
  __metrics: VisualizationMetrics;
  __lastActivity: number;
  waitForLayer: (signature: string | null, timeoutMs?: number) => Promise<any>;
  forceReplaceLayer: (newLayer: any, signature?: string) => Promise<any>;
  getCurrentLayer: () => any;
  enqueueOperation: (operation: () => Promise<any>) => Promise<any>;
  processQueue: () => Promise<void>;
  updateMetrics: (success: boolean, duration: number) => void;
}

// Exported helper to attach or retrieve a per-map VisualizationManager.
export const attachVisualizationManager = (m: any) => {
  if (!m) return null;
  if (!m.__visualizationManager) {
    const createManager = (): EnhancedVisualizationManager => {
      const vm: EnhancedVisualizationManager = { 
        inFlight: null, 
        lastSignature: null, 
        lastLayerId: null, 
        resolve: null, 
        reject: null, 
        cleanup: null,
        __inFlightTimer: null,
        __cleanupAttached: false,
        __operationQueue: [],
        __activeOperations: 0,
        __metrics: {
          totalOperations: 0,
          successfulOperations: 0,
          timeoutErrors: 0,
          averageCompletionTime: 0,
          activeOperations: 0
        },
        __lastActivity: Date.now(),
        waitForLayer: async () => null,
        forceReplaceLayer: async () => null,
        getCurrentLayer: () => null,
        enqueueOperation: async () => null,
        processQueue: async () => {},
        updateMetrics: () => {}
      };

      // Enhanced cleanup helper: clear timers, reject in-flight, cleanup queue, and remove manager reference
      vm.cleanup = () => {
        try {
          console.log('[VisualizationManager] Cleanup initiated', {
            hasInFlight: !!vm.inFlight,
            queueSize: vm.__operationQueue.length,
            activeOperations: vm.__activeOperations
          });
          
          // Clear timeout timer
          if (vm.__inFlightTimer) {
            try { clearTimeout(vm.__inFlightTimer); } catch { /* ignore */ }
            vm.__inFlightTimer = null;
          }
          
          // Reject any in-flight operations
          if (vm.inFlight && typeof vm.reject === 'function') {
            try { 
              vm.reject(new Error('VisualizationManager: map destroyed - aborting in-flight creation')); 
            } catch { /* ignore */ }
          }
          
          // Clear operation queue
          vm.__operationQueue.forEach((_, index) => {
            try {
              console.warn(`[VisualizationManager] Cancelling queued operation ${index}`);
            } catch { /* ignore */ }
          });
          vm.__operationQueue = [];
          vm.__activeOperations = 0;
          
          // Reset metrics
          vm.__metrics.activeOperations = 0;
        } catch (cleanupError) {
          console.error('[VisualizationManager] Cleanup error:', cleanupError);
        } finally {
          try { delete m.__visualizationManager; } catch { /* ignore */ }
        }
      };

      // Return currently applied analysis layer (if any) using stored lastLayerId, or fallback to first analysis layer
      vm.getCurrentLayer = () => {
        try {
          const lid = vm.lastLayerId || m.__lastAnalysisLayerId;
          if (lid) {
            const found = m.layers.find((l: any) => l.id === lid);
            if (found) return found;
          }
          const fallback = m.layers.find((layer: any) => (layer as any)?.__isAnalysisLayer);
          return fallback || null;
        } catch { return null; }
      };

      // Enhanced operation queue management
      vm.enqueueOperation = async (operation: () => Promise<any>): Promise<any> => {
        return new Promise((resolve, reject) => {
          vm.__operationQueue.push(async () => {
            try {
              const result = await operation();
              resolve(result);
              return result;
            } catch (error) {
              reject(error);
              throw error;
            }
          });
          vm.processQueue();
        });
      };
      
      vm.processQueue = async () => {
        if (vm.__activeOperations >= MAX_CONCURRENT_OPERATIONS || vm.__operationQueue.length === 0) {
          return;
        }
        
        const operation = vm.__operationQueue.shift();
        if (!operation) return;
        
        vm.__activeOperations++;
        vm.__metrics.activeOperations = vm.__activeOperations;
        
        try {
          await operation();
        } catch (error) {
          console.warn('[VisualizationManager] Queued operation failed:', error);
        } finally {
          vm.__activeOperations--;
          vm.__metrics.activeOperations = vm.__activeOperations;
          // Process next operation
          setTimeout(() => vm.processQueue(), 10);
        }
      };
      
      // Metrics update helper
      vm.updateMetrics = (success: boolean, duration: number) => {
        vm.__metrics.totalOperations++;
        if (success) {
          vm.__metrics.successfulOperations++;
        } else {
          vm.__metrics.timeoutErrors++;
        }
        
        // Update average completion time (simple moving average)
        const currentAvg = vm.__metrics.averageCompletionTime;
        const newAvg = currentAvg === 0 ? duration : (currentAvg + duration) / 2;
        vm.__metrics.averageCompletionTime = newAvg;
        
        vm.__lastActivity = Date.now();
      };

      // Enhanced wait for layer with exponential backoff and circuit breaker
      vm.waitForLayer = async (signature: string | null, timeoutMs = 15000) => {
        const start = Date.now();
        let attempt = 0;
        const maxAttempts = 5;
        
        console.log('[VisualizationManager] waitForLayer started', { signature, timeoutMs });
        
        // Fast-path: if signature matches and layer exists, return it
        try {
          if (signature && (m.__lastAnalysisSignature === signature || vm.lastSignature === signature)) {
            const cur = vm.getCurrentLayer();
            if (cur) {
              console.log('[VisualizationManager] Fast-path: existing layer found');
              return cur;
            }
          }
        } catch { /* ignore */ }

        // Circuit breaker: if too many recent timeouts, fail fast
        if (vm.__metrics.timeoutErrors > 3 && 
            vm.__metrics.timeoutErrors / vm.__metrics.totalOperations > 0.5) {
          console.warn('[VisualizationManager] Circuit breaker activated - too many recent timeouts');
          throw new Error('VisualizationManager: Circuit breaker activated due to repeated timeouts');
        }

        // If an in-flight creation is present and will resolve to our signature, await it with timeout
        if (vm.inFlight) {
          try {
            console.log('[VisualizationManager] Waiting for existing in-flight operation');
            const res = await Promise.race([
              vm.inFlight, 
              new Promise<null>(res => setTimeout(() => res(null), Math.min(timeoutMs, 10000)))
            ]);
            if (res) {
              console.log('[VisualizationManager] In-flight operation completed successfully');
              return res;
            }
            console.warn('[VisualizationManager] In-flight operation timed out');
          } catch (error) {
            console.warn('[VisualizationManager] In-flight operation failed:', error);
          }
        }

        // Exponential backoff polling with timeout
        while (Date.now() - start < timeoutMs && attempt < maxAttempts) {
          try {
            const cur = vm.getCurrentLayer();
            if (cur) {
              console.log('[VisualizationManager] Layer found after polling');
              return cur;
            }
          } catch { /* ignore */ }
          
          // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
          const delay = Math.min(100 * Math.pow(2, attempt), 1600);
          await new Promise(res => setTimeout(res, delay));
          attempt++;
        }
        
        console.warn('[VisualizationManager] waitForLayer timed out after', Date.now() - start, 'ms');
        return null;
      };

      // Force-replace current analysis layer(s) with a provided layer instance
      vm.forceReplaceLayer = async (newLayer: any, signature?: string) => {
        try {
          const existing = m.layers.filter((layer: any) => (layer as any)?.__isAnalysisLayer);
          if (existing && existing.length > 0) {
            try { m.removeMany(existing.toArray()); } catch { /* ignore */ }
          }
          try { m.add(newLayer); } catch (addErr) { throw addErr; }
          try { newLayer.__isAnalysisLayer = true; newLayer.__createdAt = Date.now(); } catch { /* ignore */ }
          if (signature) {
            vm.lastSignature = signature;
            vm.lastLayerId = newLayer.id;
            try { m.__lastAnalysisSignature = signature; m.__lastAnalysisSignatureAt = Date.now(); m.__lastAnalysisLayerId = newLayer.id; } catch { /* ignore */ }
          }
          return newLayer;
        } catch (err) {
          throw err;
        }
      };

      return vm;
    };

    m.__visualizationManager = createManager();
  }
  return m.__visualizationManager as any;
};

export const applyAnalysisEngineVisualization = async (
  visualization: VisualizationResult,
  data: ProcessedAnalysisData,
  mapView: __esri.MapView | null,
  setFormattedLegendData?: React.Dispatch<React.SetStateAction<any>>,
  onVisualizationLayerCreated?: (layer: __esri.FeatureLayer | null, shouldReplace?: boolean) => void,
  options?: { callerId?: string; forceCreate?: boolean; inflightTTLMs?: number }
): Promise<__esri.FeatureLayer | null> => {
  try {
    // Quick guard: compute a lightweight signature for this visualization+data to avoid duplicates
    const computeSignature = (vis: any, d: any) => {
      try {
        const keys = {
          rendererField: vis?.renderer?.field,
          rendererType: vis?.renderer?.type,
          targetVariable: d?.targetVariable,
          recordCount: Array.isArray(d?.records) ? d.records.length : 0,
          sampleIds: Array.isArray(d?.records) ? d.records.slice(0, 5).map((r: any) => r.area_id ?? r.ID ?? r.properties?.ID ?? r.area_name ?? '').join('|') : ''
        };
        return JSON.stringify(keys);
      } catch {
        return String(Date.now());
      }
    };

  const signature = computeSignature(visualization, data);
  const callerId = options?.callerId ?? 'unknown-caller';
  
  // Dynamic TTL based on operation complexity and historical performance
  let inflightTTL = typeof options?.inflightTTLMs === 'number' ? options!.inflightTTLMs : DEFAULT_INFLIGHT_TTL;
  
  // Adjust TTL based on data complexity
  const recordCount = data?.records?.length || 0;
  const isComplexOperation = recordCount > 1000 || callerId.includes('CMA') || callerId.includes('comparative');
  
  if (isComplexOperation) {
    inflightTTL = Math.max(inflightTTL, DEFAULT_INFLIGHT_TTL * 1.5); // 67.5s for complex ops
  } else if (recordCount < 100) {
    inflightTTL = FAST_RETRY_TTL; // 15s for simple ops
  }

  console.log('[applyAnalysisEngineVisualization] Operation analysis:', {
    caller: callerId,
    signature: signature.substring(0, 50) + '...',
    inflightTTL,
    recordCount,
    isComplexOperation,
    geometryType: (data?.records?.[0]?.geometry as any)?.type
  });

    // VisualizationManager: central in-flight promise and metadata stored on the map object
    const getVisualizationManager = (m: any) => {
      if (!m) return null;
      if (!m.__visualizationManager) {
        // Basic structure plus a cleanup helper that callers or lifecycle hooks can call
        m.__visualizationManager = { inFlight: null, lastSignature: null, lastLayerId: null, resolve: null, reject: null, cleanup: null };

        // Attach a cleanup implementation bound to this map instance
        (m.__visualizationManager as any).cleanup = () => {
          try {
            const vm = m.__visualizationManager as any;
            if (vm) {
              try {
                if (vm.__inFlightTimer) {
                  try { clearTimeout(vm.__inFlightTimer); } catch { /* ignore */ }
                  vm.__inFlightTimer = null;
                }
              } catch { /* ignore */ }
              if (vm.inFlight && typeof vm.reject === 'function') {
                try { vm.reject(new Error('VisualizationManager: map destroyed - aborting in-flight creation')); } catch { /* ignore */ }
              }
            }
          } finally {
            try { delete m.__visualizationManager; } catch { /* ignore */ }
          }
        };
      }
      return m.__visualizationManager as any;
    };

    // Enhanced promise timeout with abort controller and memory leak prevention
    const awaitPromiseWithTimeout = async (p: Promise<any> | null, timeoutMs = 8000, operation = 'unknown') => {
      if (!p) return null;
      
      const start = Date.now();
      let timeoutId: NodeJS.Timeout | null = null;
      let isResolved = false;
      
      console.log(`[VisualizationManager] Starting ${operation} with ${timeoutMs}ms timeout`);
      
      try {
        const timeoutPromise = new Promise<null>((res) => {
          timeoutId = setTimeout(() => {
            if (!isResolved) {
              console.warn(`[VisualizationManager] ${operation} timed out after ${timeoutMs}ms`);
              res(null);
            }
          }, timeoutMs);
        });
        
        const result = await Promise.race([p, timeoutPromise]);
        isResolved = true;
        
        const duration = Date.now() - start;
        console.log(`[VisualizationManager] ${operation} completed in ${duration}ms`, {
          success: result !== null,
          timeoutMs
        });
        
        return result;
      } catch (error) {
        isResolved = true;
        const duration = Date.now() - start;
        console.error(`[VisualizationManager] ${operation} failed after ${duration}ms:`, error);
        throw error;
      } finally {
        if (timeoutId) {
          try { clearTimeout(timeoutId); } catch { /* ignore */ }
          timeoutId = null;
        }
      }
    };

    // If the map already recently applied this same signature, skip creating a duplicate
    // Also, establish ownership of a visualization manager in-flight promise so concurrent callers
    // await the same creation. We set `isManagerOwner` true for the caller that creates the promise.
    let mapObjForManager: any = null;
    let vmanOwner: any = null;
    let isManagerOwner = false;
    try {
      mapObjForManager = (mapView as any)?.map;
      const vman = getVisualizationManager(mapObjForManager);

      // If map supports eventing, attach cleanup on destroy to avoid leaks (idempotent)
      try {
        if (mapObjForManager && vman && !vman.__cleanupAttached && typeof mapObjForManager.on === 'function') {
          // Some mapping libs emit 'destroy' or 'before-destroy' — try common names
          const handler = () => {
            try { if (typeof vman.cleanup === 'function') vman.cleanup(); } catch { /* ignore */ }
          };
          try { mapObjForManager.on('destroy', handler); } catch { /* ignore */ }
          try { mapObjForManager.on('before-destroy', handler); } catch { /* ignore */ }
          vman.__cleanupAttached = true;
        }
      } catch {
        // non-fatal
      }
      vmanOwner = vman;

      if (vman && vman.inFlight) {
        // If an identical signature is already in-flight, await and return its result
        if (vman.lastSignature === signature) {
          console.log('[applyAnalysisEngineVisualization] Awaiting existing in-flight visualization for same signature');
          const existing = await awaitPromiseWithTimeout(vman.inFlight, Math.min(inflightTTL * 0.8, 30000), 'same-signature-wait');
          if (existing) {
            vmanOwner?.updateMetrics(true, Date.now() - Date.now());
            return existing as __esri.FeatureLayer;
          }
          console.warn('[applyAnalysisEngineVisualization] Same signature in-flight timed out, will create new');
        } else {
          // A different visualization is in-flight — wait briefly for it to finish to avoid overlapping removals/adds
          console.log('[applyAnalysisEngineVisualization] Waiting for different in-flight visualization to complete');
          await awaitPromiseWithTimeout(vman.inFlight, 3000, 'different-signature-wait');
        }
      }

      // Quick-time duplicate guard: if the same signature was applied very recently, return stored layer
      if (mapObjForManager) {
        const lastSig = (mapObjForManager as any).__lastAnalysisSignature;
        const lastAppliedAt = (mapObjForManager as any).__lastAnalysisSignatureAt || 0;
        const now = Date.now();
        if (lastSig === signature && now - lastAppliedAt < 5000) {
          console.log('[applyAnalysisEngineVisualization] Duplicate visualization detected (recent signature match). Returning existing analysis layer');
          const existingLayerId = (mapObjForManager as any).__lastAnalysisLayerId as string | undefined;
          if (existingLayerId) {
            const existing = mapObjForManager.layers.find((l: any) => l.id === existingLayerId);
            if (existing) return existing as __esri.FeatureLayer;
          }
          const found = mapObjForManager.layers.find((layer: any) => (layer as any)?.__isAnalysisLayer);
          if (found) return found as __esri.FeatureLayer;
        }
      }

      // If no in-flight exists, the first caller becomes the owner and creates the inFlight promise
      if (vman && !vman.inFlight) {
        // Check if we should throttle based on recent activity
        if (vman.__activeOperations >= MAX_CONCURRENT_OPERATIONS) {
          console.log(`[VisualizationManager] Too many active operations (${vman.__activeOperations}), enqueueing...`);
          return await vman.enqueueOperation(async () => {
            return await applyAnalysisEngineVisualization(visualization, data, mapView, setFormattedLegendData, onVisualizationLayerCreated, {
              ...options,
              inflightTTLMs: FAST_RETRY_TTL // Use shorter timeout for queued operations
            });
          });
        }
        
        isManagerOwner = true;
        const operationStartTime = Date.now();
        
        vman.inFlight = new Promise((resolve, reject) => {
          vman.resolve = (value: any) => {
            const duration = Date.now() - operationStartTime;
            vman.updateMetrics(true, duration);
            console.log(`[VisualizationManager] Operation completed successfully in ${duration}ms`);
            resolve(value);
          };
          vman.reject = (error: Error) => {
            const duration = Date.now() - operationStartTime;
            vman.updateMetrics(false, duration);
            console.error(`[VisualizationManager] Operation failed after ${duration}ms:`, error);
            reject(error);
          };
        });
        
        try {
          // Start a per-call TTL that will reject the in-flight creation if it takes too long
          try { if (vman.__inFlightTimer) { clearTimeout(vman.__inFlightTimer); } } catch { }
          
          console.log(`[VisualizationManager] Starting TTL timer for ${inflightTTL}ms`);
          vman.__inFlightTimer = setTimeout(() => {
            try {
              if (vman && typeof vman.reject === 'function') {
                const timeoutError = new Error(`VisualizationManager: in-flight creation timed out after ${inflightTTL}ms (caller: ${callerId})`);
                console.error('[VisualizationManager] TTL timeout triggered:', {
                  callerId,
                  inflightTTL,
                  activeOperations: vman.__activeOperations,
                  queueSize: vman.__operationQueue.length,
                  metrics: vman.__metrics
                });
                vman.reject(timeoutError);
              }
            } catch { /* ignore */ }
            try { vman.inFlight = null; } catch { /* ignore */ }
          }, inflightTTL);
        } catch (timerError) {
          console.error('[VisualizationManager] Failed to set TTL timer:', timerError);
        }
      }
    } catch (guardErr) {
      console.warn('[applyAnalysisEngineVisualization] Signature/vman guard failed:', guardErr);
    }
    // Validate inputs first
    if (!visualization) {
      console.error('[applyAnalysisEngineVisualization] ❌ No visualization object provided');
      return null;
    }
    
    if (!data) {
      console.error('[applyAnalysisEngineVisualization] ❌ No data object provided');
      return null;
    }
    
    if (!mapView) {
      console.error('[applyAnalysisEngineVisualization] ❌ No map view provided');
      return null;
    }
    
    console.log('[applyAnalysisEngineVisualization] Starting with:', {
      visualizationType: visualization?.type,
      hasRenderer: !!visualization?.renderer,
  rendererType: (visualization?.renderer as any)?.type,
  rendererKeys: visualization?.renderer ? Object.keys(visualization.renderer as any) : [],
      recordCount: data?.records?.length,
      sampleRecord: data?.records?.[0] ? {
        hasGeometry: !!(data.records[0] as any).geometry,
        geometryType: (data.records[0] as any).geometry?.type,
        hasAreaId: !!(data.records[0] as any).area_id,
        hasProperties: !!(data.records[0] as any).properties,
        allKeys: Object.keys(data.records[0]),
        sampleGeometry: (data.records[0] as any).geometry ? {
          type: (data.records[0] as any).geometry.type,
          hasCoordinates: !!(data.records[0] as any).geometry.coordinates,
          coordinatesLength: (data.records[0] as any).geometry.coordinates?.length,
          firstCoordinate: (data.records[0] as any).geometry.coordinates?.[0]?.[0]
        } : null,
        sampleAreaId: (data.records[0] as any).area_id,
        sampleAreaName: (data.records[0] as any).area_name,
        sampleValue: (data.records[0] as any).value
      } : 'No records'
    });

    // CRITICAL DEBUG: Check if we have ANY records at all
    if (!data.records || data.records.length === 0) {
      console.warn('[applyAnalysisEngineVisualization] ⚠️ NO RECORDS PROVIDED TO VISUALIZATION - Creating empty layer with message');
      console.warn('[applyAnalysisEngineVisualization] Data structure:', data);
      
      // Instead of failing, create an empty layer with a helpful message
      return await createEmptyVisualizationLayer(mapView, {
        title: 'No Data Available',
        message: 'No records found for this analysis. Try adjusting your query or selection area.',
        analysisType: data.type || 'analysis'
      });
    }

    console.log('[applyAnalysisEngineVisualization] ✅ Records found, checking geometry...');

    // Check if records have geometry
  const recordsWithGeometry = (data.records as any[]).filter((record: any) => record.geometry && (record.geometry as any).coordinates);
    console.log('[applyAnalysisEngineVisualization] Geometry check:', {
      totalRecords: data.records.length,
      recordsWithGeometry: recordsWithGeometry.length,
      geometryTypes: [...new Set(recordsWithGeometry.map((r: any) => (r.geometry as any)?.type))],
      sampleGeometry: recordsWithGeometry[0]?.geometry ? {
        type: (recordsWithGeometry[0].geometry as any).type,
        hasCoordinates: !!(recordsWithGeometry[0].geometry as any).coordinates,
        coordinatesLength: (recordsWithGeometry[0].geometry as any).coordinates?.length
      } : 'No geometry found',
      isClustered: data.isClustered
    });

    if (recordsWithGeometry.length === 0) {
      console.warn('[applyAnalysisEngineVisualization] ⚠️ No records with valid geometry found - Creating table-only layer');
      
      // Instead of failing, create a table-only layer that shows the data in a list/popup format
      return await createTableOnlyVisualizationLayer(mapView, data, visualization, {
        title: 'Analysis Results (No Map Data)',
        message: `Found ${data.records.length} results but no geographic coordinates available. Data will be displayed in table format.`,
        analysisType: data.type || 'analysis'
      });
    }
    
    // Validate renderer configuration
    if (!visualization.renderer) {
      console.error('[applyAnalysisEngineVisualization] ❌ No renderer in visualization object');
      console.error('[applyAnalysisEngineVisualization] Visualization object:', visualization);
      return null;
    }

    // Import ArcGIS modules
    let FeatureLayer, Graphic;
    try {
      [FeatureLayer, Graphic] = await Promise.all([
        import('@arcgis/core/layers/FeatureLayer').then(m => m.default),
        import('@arcgis/core/Graphic').then(m => m.default)
      ]);
      
      console.log('[applyAnalysisEngineVisualization] ✅ ArcGIS modules imported successfully');
    } catch (importError) {
      console.error('[applyAnalysisEngineVisualization] ❌ Failed to import ArcGIS modules:', importError);
      return null;
    }

    // Convert AnalysisEngine data to ArcGIS features
    const initialFeatures = data.records.map((record: any, index: number) => {
      // Only create features with valid geometry
  if (!record.geometry || !(record.geometry as any).coordinates) {
        console.warn(`[applyAnalysisEngineVisualization] ❌ Skipping record ${index} - no valid geometry`);
        return null;
      }

      // Convert GeoJSON geometry to ArcGIS geometry format
      let arcgisGeometry: any = null;
      
      try {
  if ((record.geometry as any).type === 'Polygon') {
          // Check if visualization renderer wants to use centroids
          const useCentroids = (visualization.renderer as any)?._useCentroids;
          
          if (useCentroids) {
            // Use centroid from boundary properties if available, otherwise calculate it
            const centroidGeometry = (record.properties as any)?.centroid;
            if (centroidGeometry && centroidGeometry.coordinates) {
              arcgisGeometry = new Point({
                x: centroidGeometry.coordinates[0],
                y: centroidGeometry.coordinates[1],
                spatialReference: { wkid: 4326 }
              });
            } else {
              // Calculate centroid from polygon coordinates
              const coordinates = (record.geometry as any).coordinates[0]; // First ring
              let sumX = 0, sumY = 0;
              let validCoords = 0;
              
              coordinates.forEach((coord: number[]) => {
                if (coord && coord.length >= 2 && !isNaN(coord[0]) && !isNaN(coord[1])) {
                  sumX += coord[0];
                  sumY += coord[1];
                  validCoords++;
                }
              });
              
              if (validCoords === 0) {
                console.warn(`[applyAnalysisEngineVisualization] No valid coordinates for ${record.area_name}`);
                return null;
              }
              
              const centroidX = sumX / validCoords;
              const centroidY = sumY / validCoords;

              if (isNaN(centroidX) || isNaN(centroidY)) {
                console.warn(`[applyAnalysisEngineVisualization] Invalid centroid calculated for ${record.area_name}`);
                return null;
              }

              arcgisGeometry = new Point({
                x: centroidX,
                y: centroidY,
                spatialReference: { wkid: 4326 }
              });
            }
          } else {
            // GeoJSON Polygon to ArcGIS Polygon - use proper Polygon class
            arcgisGeometry = new Polygon({
              rings: (record.geometry as any).coordinates,
              spatialReference: { wkid: 4326 }
            });
          }
        } else if ((record.geometry as any).type === 'Point') {
          // GeoJSON Point to ArcGIS Point - use proper Point class
          const coords = (record.geometry as any).coordinates;
          arcgisGeometry = new Point({
            x: coords[0],
            y: coords[1],
            spatialReference: { wkid: 4326 }
          });

        } else {
          console.warn(`[applyAnalysisEngineVisualization] Unsupported geometry type: ${(record.geometry as any).type}`);
          return null;
        }
      } catch (geoError) {
        console.error(`[applyAnalysisEngineVisualization] Geometry conversion error for record ${index}:`, geoError);
        return null;
      }

      // Create essential attributes for visualization
      const resolvedName = (() => {
        try {
          return resolveSharedAreaName(record, { mode: 'zipCity', neutralFallback: '' }) || '';
        } catch { return ''; }
      })();

        // Create essential attributes for visualization (minimal fields + single score)
        const essentialAttributes: any = {
        OBJECTID: index + 1,
        area_name: resolvedName || record.area_name || record.properties?.DESCRIPTION || record.area_id || `Area ${index + 1}`,
        ID: String(record.properties?.ID || record.area_id || ''),
        DESCRIPTION: record.properties?.DESCRIPTION || resolvedName || record.area_name || `Area ${record.area_id ?? index + 1}`,
        
        // Target variable field (dynamic based on analysis type) - prioritize record[targetVariable] for proper field mapping
        [data.targetVariable]: typeof record[data.targetVariable] === 'number' ? record[data.targetVariable] :
                               typeof record.value === 'number' ? record.value : 
                               typeof record.properties?.[data.targetVariable] === 'number' ? record.properties[data.targetVariable] : 0
      };

        // Also set a generic 'value' equal to the target variable for legacy compatibility
        if (data.targetVariable && typeof essentialAttributes[data.targetVariable] === 'number') {
          essentialAttributes.value = essentialAttributes[data.targetVariable];
        } else if (typeof record.value === 'number') {
          essentialAttributes.value = record.value;
        } else {
          essentialAttributes.value = 0;
        }

        // Ensure any fields referenced by the renderer exist on the feature (minimal set)
        const rendererFields = new Set<string>();
        if ((visualization as any)?.renderer?.field) {
          rendererFields.add((visualization as any).renderer.field as string);
        }
        const vvs = (visualization as any)?.renderer?.visualVariables as Array<{ field?: string }> | undefined;
        if (Array.isArray(vvs)) {
          vvs.forEach(vv => { if (vv?.field) rendererFields.add(vv.field); });
        }
        rendererFields.forEach(fieldName => {
          if (!fieldName) return;
          const valTop = (record as any)[fieldName];
          const valProps = (record as any).properties?.[fieldName];
          const val = valTop ?? valProps;

          if (val !== undefined) {
            (essentialAttributes as Record<string, unknown>)[fieldName] = val as unknown;
          }
        });

  // Note: Do NOT add demographic or other numeric attributes here to keep popups minimal.

      const graphic = new Graphic({
        geometry: arcgisGeometry,
        attributes: essentialAttributes
      });

      return graphic;
    }).filter(feature => feature !== null); // Remove null features

    // DEDUPLICATION: Remove duplicate features with the same geometry
    // Keep only the first occurrence of each unique geometry
    const seenGeometries = new Set<string>();
    const dedupedFeatures = initialFeatures.filter((feature, index) => {
      const geom = feature.geometry;
      if (!geom) return false;
      
      // Create a geometry fingerprint
      let fingerprint = '';
      if (geom.type === 'point') {
        fingerprint = `${(geom as any).x},${(geom as any).y}`;
      } else if (geom.type === 'polygon' && (geom as any).rings) {
        const firstRing = (geom as any).rings[0];
        if (firstRing && firstRing.length > 2) {
          // Use first 3 coordinate pairs as fingerprint
          fingerprint = JSON.stringify(firstRing.slice(0, 3));
        }
      }
      
      if (!fingerprint || seenGeometries.has(fingerprint)) {
        console.warn(`[applyAnalysisEngineVisualization] Removing duplicate geometry at index ${index}:`, {
          ID: feature.getAttribute('ID'),
          area_name: feature.getAttribute('area_name'),
          value: feature.getAttribute(data.targetVariable)
        });
        return false; // Skip duplicate
      }
      
      seenGeometries.add(fingerprint);
      return true; // Keep first occurrence
    });
    
    console.log(`[applyAnalysisEngineVisualization] Deduplication complete:`, {
      originalCount: initialFeatures.length,
      dedupedCount: dedupedFeatures.length,
      removedCount: initialFeatures.length - dedupedFeatures.length
    });
    
  // Use deduplicated features from here on
  let arcgisFeatures = dedupedFeatures;

    // Check for duplicate area IDs using the ID field (ZIP code or FSA)
    const areaIds = arcgisFeatures.map(f => f.getAttribute('ID')).filter(id => id);
    const uniqueAreaIds = [...new Set(areaIds)];
    const duplicateCount = areaIds.length - uniqueAreaIds.length;
    
    // Check for duplicate or overlapping geometries with more robust geometry access
    const geometryFingerprints = arcgisFeatures.map((f, index) => {
      try {
        const geom = f.geometry;

        if (!geom || !geom.type) {
          return null;
        }

        // Handle point geometries
        if (geom.type === 'point') {
          const coords = [(geom as any).x, (geom as any).y];
          const fingerprint = JSON.stringify(coords);
          return fingerprint;
        }

        // Handle polygon geometries
        if (geom.type === 'polygon' && (geom as any).rings && (geom as any).rings.length > 0) {
          const firstRing = (geom as any).rings[0];
          if (firstRing && Array.isArray(firstRing) && firstRing.length > 2) {
            const coords = firstRing.slice(0, Math.min(3, firstRing.length));
            const fingerprint = JSON.stringify(coords);
            return fingerprint;
          }
        }

        // Unsupported geometry type
        return null;
      } catch (err) {
        console.warn(`[applyAnalysisEngineVisualization] Error processing geometry for feature ${index}:`, err);
        return null;
      }
    }).filter(fp => fp);

    const uniqueGeometries = [...new Set(geometryFingerprints)];
    const duplicateGeometryCount = geometryFingerprints.length - uniqueGeometries.length;
    
    console.log('[applyAnalysisEngineVisualization] Created features:', {
      totalFeatures: arcgisFeatures.length,
      skippedFeatures: data.records.length - arcgisFeatures.length,
      geometryType: arcgisFeatures[0]?.geometry?.type,
      areaIdsFound: areaIds.length,
      uniqueAreaIds: uniqueAreaIds.length,
      duplicateFeatures: duplicateCount,
      geometriesFound: geometryFingerprints.length,
      uniqueGeometries: uniqueGeometries.length,
      duplicateGeometries: duplicateGeometryCount
    });
    
      if (duplicateCount > 0) {
      console.warn(`[applyAnalysisEngineVisualization] ⚠️  FOUND ${duplicateCount} DUPLICATE IDs`);
      const idCounts: Record<string, number> = {};
      areaIds.forEach(id => { idCounts[id] = (idCounts[id] || 0) + 1; });
      const duplicates = Object.entries(idCounts).filter(([, count]) => (count as number) > 1);
      console.warn('[applyAnalysisEngineVisualization] Duplicate IDs:', duplicates.slice(0, 5));
    }
    
  if (duplicateGeometryCount > 0) {
      console.warn(`[applyAnalysisEngineVisualization] ⚠️  FOUND ${duplicateGeometryCount} DUPLICATE GEOMETRIES - this causes overlapping colors!`);
      
      // Find which features have duplicate geometries and their different scores
      const geometryMap: Record<string, any[]> = {};
      arcgisFeatures.forEach(f => {
        const geom = f.geometry;
        if (geom && geom.type === 'polygon' && (geom as any).rings) {
          const firstRing = (geom as any).rings[0];
          if (firstRing && firstRing.length > 2) {
            const coords = firstRing.slice(0, 3);
            const fingerprint = JSON.stringify(coords);
            if (!geometryMap[fingerprint]) geometryMap[fingerprint] = [];
            geometryMap[fingerprint].push({
              ID: f.getAttribute('ID'),
              score: f.getAttribute(data.targetVariable),
              areaName: f.getAttribute('area_name')
            });
          }
        }
      });
      
      // Log examples of overlapping geometries with different scores
      Object.entries(geometryMap).filter(([, features]) => features.length > 1).slice(0, 3).forEach(([fingerprint, features]) => {
        console.warn(`[applyAnalysisEngineVisualization] Same geometry (${fingerprint.substring(0, 50)}...) has ${features.length} features:`, features);
      });

      // Coalesce overlapping geometries to a single feature to prevent overlapping colors.
      // Strategy: for each fingerprint keep the feature with the highest numeric score (fall back to first).
      try {
        const fingerprintToChosenID: Record<string, string> = {};
        Object.entries(geometryMap).forEach(([fingerprint, features]) => {
          if (!features || features.length === 0) return;
          // Pick feature with max score (score may be undefined/null)
          let chosen = features[0];
          for (const f of features) {
            const cur = typeof f.score === 'number' ? f.score : Number.NaN;
            const best = typeof chosen.score === 'number' ? chosen.score : Number.NaN;
            if (!Number.isNaN(cur) && (Number.isNaN(best) || cur > best)) chosen = f;
          }
          fingerprintToChosenID[fingerprint] = String(chosen.ID);
        });

        // Filter arcgisFeatures to only keep chosen IDs for polygon fingerprints
        arcgisFeatures = arcgisFeatures.filter((f) => {
          try {
            const geom = f.geometry;
            if (geom && geom.type === 'polygon' && (geom as any).rings) {
              const firstRing = (geom as any).rings[0];
              if (firstRing && Array.isArray(firstRing)) {
                const fp = JSON.stringify(firstRing.slice(0, Math.min(3, firstRing.length)));
                const keepId = fingerprintToChosenID[fp];
                if (keepId !== undefined) {
                  return String(f.getAttribute('ID')) === String(keepId);
                }
              }
            }
          } catch {
              // If anything fails, keep the feature so we don't accidentally drop valid data
              return true;
            }
          return true;
        });

        console.log('[applyAnalysisEngineVisualization] Coalesced overlapping geometries to prevent color mixing:', { newCount: arcgisFeatures.length });
      } catch (coalesceErr) {
        console.warn('[applyAnalysisEngineVisualization] Failed to coalesce overlapping geometries, continuing with original features:', coalesceErr);
      }
    }

    if (arcgisFeatures.length === 0) {
      console.error('[applyAnalysisEngineVisualization] 🔥 NO VALID ARCGIS FEATURES CREATED - LAYER WILL BE EMPTY');
      throw new Error('No valid features with geometry to visualize');
    }

    // Determine the actual geometry type from the features themselves
    const firstFeatureGeometry = arcgisFeatures[0]?.geometry;
    const detectedType = firstFeatureGeometry?.type || 'polygon';

    // Map detected type to valid FeatureLayer geometry types
    // "extent" is not a valid FeatureLayer type, treat it as "polygon"
    const actualGeometryType: "point" | "multipoint" | "polyline" | "polygon" | "multipatch" | "mesh" =
      detectedType === 'extent' ? 'polygon' :
      (detectedType as "point" | "multipoint" | "polyline" | "polygon" | "multipatch" | "mesh");

    console.log('[applyAnalysisEngineVisualization] 🔍 Geometry type detection:', {
      detectedType,
      actualGeometryType,
      firstFeatureHasGeometry: !!firstFeatureGeometry,
      geometryConstructor: firstFeatureGeometry?.constructor?.name
    });

    // Generate field definitions based on what attributes actually exist
    const essentialFields: __esri.FieldProperties[] = [
      { name: 'OBJECTID', type: 'oid' },
      { name: 'area_name', type: 'string' },
      { name: 'value', type: 'double' },
      { name: 'ID', type: 'string' },
      { name: data.targetVariable || 'value', type: 'double' }
    ];

    // Do NOT auto-add other numeric/demographic fields to keep popups minimal.

    // Create feature layer
    let featureLayer;
    try {
      const layerId = `analysis-layer-${Date.now()}`;
      console.log('[applyAnalysisEngineVisualization] ✨ Creating analysis layer with ID:', layerId);
      
      // Prefer the renderer produced by VisualizationRenderer (it may have applied diagnostics/fallbacks)
      const rendererFromVisualization = (visualization as any)?.renderer;
      const rendererFromData = (data as any)?.renderer;
      const chosenRenderer = rendererFromVisualization || rendererFromData;

      // Ensure the renderer field exists in our field definitions (ArcGIS requires declared fields)
      const rendererField: string | undefined = (chosenRenderer as any)?.field;
      if (rendererField && !essentialFields.some(f => f.name === rendererField)) {
        console.log('[applyAnalysisEngineVisualization] 🧩 Adding renderer field to layer schema:', rendererField);
        essentialFields.push({ name: rendererField, type: 'double' });
      }

      // Log which renderer we will use
      console.log('[applyAnalysisEngineVisualization] Renderer selection:', {
        used: rendererFromVisualization ? 'visualization' : (rendererFromData ? 'data' : 'none'),
        field: (chosenRenderer as any)?.field,
        type: (chosenRenderer as any)?.type
      });

      featureLayer = new FeatureLayer({
        id: layerId,
        source: arcgisFeatures,
        fields: essentialFields,
        objectIdField: 'OBJECTID',
        geometryType: actualGeometryType,
        spatialReference: { wkid: 4326 },
        renderer: chosenRenderer as any,
        popupEnabled: false,
        title: `AnalysisEngine - ${data.targetVariable || 'Analysis'}`,
        visible: true,
        opacity: 0.8
      });

      console.log('[applyAnalysisEngineVisualization] FeatureLayer created successfully:', {
        layerId: featureLayer.id,
        layerType: featureLayer.type,
        layerTitle: featureLayer.title
      });
      
    } catch (featureLayerError) {
      console.error('[applyAnalysisEngineVisualization] Failed to create FeatureLayer:', featureLayerError);
      throw new Error(`FeatureLayer creation failed: ${featureLayerError}`);
    }

  // Add the new layer to map with a lightweight map-level async lock to avoid
  // near-simultaneous duplicate creations from concurrent callers.
  console.log('[applyAnalysisEngineVisualization] 🎯 Adding analysis layer to map (acquiring lock)');

  // visualization manager (if present) is accessed via getVisualizationManager earlier

    // Enhanced lock management with exponential backoff and deadlock detection
    const waitForUnlock = async (m: any, timeoutMs = 12000) => {
      const start = Date.now();
      let attempt = 0;
      const maxAttempts = 20;
      
      console.log('[VisualizationManager] Waiting for analysis lock to clear');
      
      while (m.__analysisLock && Date.now() - start < timeoutMs && attempt < maxAttempts) {
        // Check for potential deadlock
        if (attempt > 10) {
          console.warn(`[VisualizationManager] Potential deadlock detected after ${attempt} attempts`);
          // Force clear lock if it's been held too long (>30s)
          const lockAge = Date.now() - (m.__analysisLockTime || Date.now());
          if (lockAge > 30000) {
            console.error('[VisualizationManager] Force clearing stale lock after 30s');
            m.__analysisLock = false;
            delete m.__analysisLockTime;
            break;
          }
        }
        
        // Exponential backoff with jitter
        const baseDelay = Math.min(50 * Math.pow(1.5, attempt), 500);
        const jitter = Math.random() * 50;
        const delay = baseDelay + jitter;
        
        await new Promise((res) => setTimeout(res, delay));
        attempt++;
      }
      
      const isUnlocked = !m.__analysisLock;
      console.log(`[VisualizationManager] Lock wait completed:`, {
        isUnlocked,
        duration: Date.now() - start,
        attempts: attempt
      });
      
      return isUnlocked;
    };

    try {
      if (mapObjForManager) {
        // If a lock is already set, wait briefly for it to clear (up to 2s)
        if (mapObjForManager.__analysisLock) {
          console.log('[applyAnalysisEngineVisualization] Waiting for existing analysis lock');
          await waitForUnlock(mapObjForManager, 2000);
        }

        // Acquire lock with timestamp for deadlock detection
        mapObjForManager.__analysisLock = true;
        mapObjForManager.__analysisLockTime = Date.now();
        console.log('[VisualizationManager] Analysis lock acquired');
      }

      // Remove any existing analysis layers INSIDE THE LOCK (check both title and __isAnalysisLayer property)
      const existingLayers = mapView.map.layers.filter((layer) => {
        const title = (layer as __esri.Layer).title as string | undefined;
        const isAnalysisLayer = (layer as any).__isAnalysisLayer === true;
        const hasAnalysisTitle = Boolean(title && (title.includes('Analysis') || title.includes('AnalysisEngine')));
        return isAnalysisLayer || hasAnalysisTitle;
      });
      
      if (existingLayers.length > 0) {
        console.log('[applyAnalysisEngineVisualization] 🗑️ REMOVING EXISTING ANALYSIS LAYERS:', {
          layerCount: existingLayers.length,
          reason: 'Adding new visualization layer (inside lock)'
        });
      }
      
      mapView.map.removeMany(existingLayers.toArray());
      
      // ALSO remove SampleAreasPanel graphics that might overlap with analysis
      // These are graphics with zipCode attribute added by SampleAreasPanel
      const sampleAreaGraphics = mapView.graphics.toArray().filter((graphic: any) => 
        graphic.attributes && graphic.attributes.zipCode
      );
      
      if (sampleAreaGraphics.length > 0) {
        console.log('[applyAnalysisEngineVisualization] 🗑️ REMOVING SAMPLE AREA GRAPHICS:', {
          graphicCount: sampleAreaGraphics.length,
          reason: 'Preventing overlap with analysis visualization'
        });
        mapView.graphics.removeMany(sampleAreaGraphics);
      }

      // Perform the add while lock is held
      mapView.map.add(featureLayer);

      // Store metadata for theme switch protection
      // Tag metadata in a type-safe way
      (featureLayer as unknown as { __isAnalysisLayer?: boolean }).__isAnalysisLayer = true;
      (featureLayer as unknown as { __createdAt?: number }).__createdAt = Date.now();

      // Also store last-applied signature and layer id for the duplicate-guard
      try {
        if (mapObjForManager) {
          mapObjForManager.__lastAnalysisSignature = signature;
          mapObjForManager.__lastAnalysisSignatureAt = Date.now();
          mapObjForManager.__lastAnalysisLayerId = featureLayer.id;
          // If a visualization manager exists, resolve its in-flight promise
          if (vmanOwner) {
            vmanOwner.lastSignature = signature;
            vmanOwner.lastLayerId = featureLayer.id;
            if (typeof vmanOwner.resolve === 'function') {
              try { vmanOwner.resolve(featureLayer); } catch { /* ignore */ }
            }
          }
        }
      } catch (metaErr) {
        console.warn('[applyAnalysisEngineVisualization] Failed to write map metadata:', metaErr);
      }

      console.log('[applyAnalysisEngineVisualization] ✅ Analysis layer added with protection metadata');
    } catch (addErr) {
      // If we are the manager owner, reject the in-flight promise so awaiters fail fast
      try {
        if (isManagerOwner && vmanOwner && typeof vmanOwner.reject === 'function') {
          vmanOwner.reject(addErr);
        }
      } catch {
        // ignore
      }
      throw addErr;
    } finally {
      // Always release lock and cleanup timestamp
      try {
        if (mapObjForManager) {
          mapObjForManager.__analysisLock = false;
          delete mapObjForManager.__analysisLockTime;
          console.log('[VisualizationManager] Analysis lock released');
        }
      } catch (releaseErr) {
        console.warn('[applyAnalysisEngineVisualization] Failed to clear analysis lock:', releaseErr);
      }

      // Cleanup visualization manager in-flight state if we own it
      try {
        if (isManagerOwner && vmanOwner) {
          try { if (vmanOwner.__inFlightTimer) { clearTimeout(vmanOwner.__inFlightTimer); vmanOwner.__inFlightTimer = null; } } catch { /* ignore */ }
          vmanOwner.inFlight = null;
          vmanOwner.resolve = null;
          vmanOwner.reject = null;
        }
      } catch {
        // ignore
      }
    }

    // Create legend data from the renderer if setFormattedLegendData is provided
    if (setFormattedLegendData) {
      try {
        const { formatLegendDataFromRenderer } = await import('@/utils/legend-formatter');
        const renderer = featureLayer.renderer;
        
        if (renderer) {
          console.log('[applyAnalysisEngineVisualization] 🎯 Creating legend from renderer');
          
          const legendItems = formatLegendDataFromRenderer(renderer);
          
          if (legendItems && legendItems.length > 0) {
            const legendTitle = data.targetVariable ? 
              data.targetVariable.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
              'Analysis Result';
            
            const legendData = {
              title: legendTitle,
              items: legendItems.map(item => ({
                label: item.label,
                color: item.color,
                value: item.minValue
              }))
            };
            
            console.log('[applyAnalysisEngineVisualization] 🎯 Setting legend data from renderer');
            setFormattedLegendData(legendData);
          }
        }
      } catch (legendError) {
        console.error('[applyAnalysisEngineVisualization] 🚨 Failed to create legend from renderer:', legendError);
      }
    }

    // Notify parent component that visualization layer was created (for CustomPopupManager integration)
    if (onVisualizationLayerCreated) {
      console.log('[applyAnalysisEngineVisualization] 🎯 Calling onVisualizationLayerCreated for CustomPopupManager integration');
      onVisualizationLayerCreated(featureLayer, true);
    }

    // Set up popup action handler for drilldown ("View Properties" button)
    const handlePopupAction = (event: any) => {
      if (event.action.id === 'view-properties') {
        const feature = mapView.popup?.selectedFeature;
        if (!feature) return;

        console.log('[applyAnalysisEngineVisualization] 🔍 View Properties clicked:', {
          featureID: feature.attributes?.ID,
          featureType: data.type,
          viewMode: (data as any).metadata?.viewMode
        });

        // Check if this is an aggregate view that supports drilldown
        const isAggregateView = (data as any).metadata?.viewMode === 'aggregate';
        const fsaCode = feature.attributes?.ID || feature.attributes?.area_id;

        if (isAggregateView && fsaCode) {
          console.log('[applyAnalysisEngineVisualization] 🎯 Triggering drilldown to FSA:', fsaCode);

          // Trigger a custom event that can be caught by UnifiedAnalysisWorkflow
          const drilldownEvent = new CustomEvent('analysis-drilldown', {
            detail: {
              drilldownKey: fsaCode,
              viewMode: 'detail',
              analysisType: data.type
            }
          });
          window.dispatchEvent(drilldownEvent);
        }
      }
    };

    // Remove any existing handler and add new one
    if ((mapView as any).__popupActionHandler) {
      (mapView as any).__popupActionHandler.remove();
    }
    (mapView as any).__popupActionHandler = mapView.popup?.on('trigger-action', handlePopupAction);

    // Final step: Zoom and center to the feature extent (works for polygons, points, clusters, buffers)
    try {
      console.log('[applyAnalysisEngineVisualization] 🎯 Preparing to zoom to new layer extent...');

      // Compute extent from the created graphics (robust for client-side layers)
      const computeExtentFromGraphics = async (graphics: __esri.Graphic[]): Promise<__esri.Extent | null> => {
        let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
        let hasValid = false;

        const updateBounds = (x: number, y: number) => {
          if (Number.isFinite(x) && Number.isFinite(y)) {
            xmin = Math.min(xmin, x);
            ymin = Math.min(ymin, y);
            xmax = Math.max(xmax, x);
            ymax = Math.max(ymax, y);
            hasValid = true;
          }
        };

        for (const g of graphics) {
          const geom = g?.geometry as __esri.Geometry | null;
          if (!geom) continue;
          if (geom.type === 'point') {
            const pt = geom as __esri.Point;
            if (Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
              updateBounds(pt.x, pt.y);
            }
          } else if (geom.type === 'polygon') {
            const poly = geom as __esri.Polygon;
            const rings = poly.rings as unknown as number[][][];
            if (Array.isArray(rings)) {
              for (const ring of rings) {
                for (const coord of ring) {
                  const x = coord?.[0];
                  const y = coord?.[1];
                  updateBounds(x, y);
                }
              }
            }
          }
        }

        if (!hasValid) return null;

        const Extent = (await import('@arcgis/core/geometry/Extent')).default;
        return new Extent({ xmin, ymin, xmax, ymax, spatialReference: { wkid: 4326 } });
      };

      const extent = await computeExtentFromGraphics((featureLayer.source as unknown as __esri.Graphic[]) || []);

      // Fallbacks: try layer.fullExtent after load, or center on first graphic
      let finalTarget: __esri.Extent | { center: [number, number]; scale: number } | null = extent;
      if (!finalTarget) {
        try {
          await featureLayer.load();
          finalTarget = featureLayer.fullExtent ?? null;
        } catch {
          // ignore
        }
      }
      if (!finalTarget) {
        const first = (featureLayer.source as unknown as __esri.Graphic[])?.[0];
        const geom = first?.geometry as __esri.Geometry | undefined;
        if (geom?.type === 'point') {
          const pt = geom as __esri.Point;
          finalTarget = { center: [pt.x, pt.y], scale: 120000 };
        }
      }

      if (finalTarget) {
        try {
          // Expand a bit for nice padding when using extent
          if ('xmin' in (finalTarget as object)) {
            // It's an extent
            finalTarget = (finalTarget as __esri.Extent).expand(1.15);
          }
          console.log('[applyAnalysisEngineVisualization] 🔭 goTo target prepared, executing view.goTo...');
          await mapView.goTo(finalTarget, { duration: 800 });
          console.log('[applyAnalysisEngineVisualization] ✅ View centered and zoomed to new layer extent');
        } catch (goToErr) {
          console.warn('[applyAnalysisEngineVisualization] ⚠️ view.goTo failed, continuing without zoom:', goToErr);
        }
      } else {
        console.warn('[applyAnalysisEngineVisualization] ⚠️ Could not determine extent to zoom to');
      }
    } catch (zoomErr) {
      console.warn('[applyAnalysisEngineVisualization] ⚠️ Zoom-to-extent step failed:', zoomErr);
    }

    console.log('[applyAnalysisEngineVisualization] ✅ Visualization applied successfully');
    return featureLayer;

  } catch (error) {
    console.error('[applyAnalysisEngineVisualization] Failed to apply visualization:', error);
    return null;
  }
};

/**
 * Helper function to create an empty visualization layer when no records are found
 */
async function createEmptyVisualizationLayer(mapView: any, options: {
  title: string;
  message: string;
  analysisType: string;
}): Promise<__esri.FeatureLayer | null> {
  try {
    console.log('[createEmptyVisualizationLayer] Creating empty layer with message:', options.message);
    
    const [FeatureLayer, GraphicsLayer] = await Promise.all([
      import('@arcgis/core/layers/FeatureLayer').then(m => m.default),
      import('@arcgis/core/layers/GraphicsLayer').then(m => m.default)
    ]);

    // Create a simple message layer
    const messageLayer = new GraphicsLayer({
      title: options.title,
      id: `empty-analysis-${Date.now()}`,
    });

    // Add to map
    mapView?.map.add(messageLayer);
    
    // Mark as analysis layer for cleanup
    (messageLayer as any).__isAnalysisLayer = true;
    (messageLayer as any).__isEmpty = true;
    (messageLayer as any).__emptyMessage = options.message;

    console.log('[createEmptyVisualizationLayer] ✅ Empty layer created successfully');
    return messageLayer as any; // Return as FeatureLayer-compatible for interface consistency

  } catch (error) {
    console.error('[createEmptyVisualizationLayer] Failed to create empty layer:', error);
    return null;
  }
}

/**
 * Helper function to create a table-only visualization when records exist but have no geometry
 */
async function createTableOnlyVisualizationLayer(
  mapView: any, 
  data: ProcessedAnalysisData,
  visualization: VisualizationResult,
  options: {
    title: string;
    message: string;
    analysisType: string;
  }
): Promise<__esri.FeatureLayer | null> {
  try {
    console.log('[createTableOnlyVisualizationLayer] Creating table-only layer for', data.records.length, 'records');
    
    const [FeatureLayer, Field, Graphic] = await Promise.all([
      import('@arcgis/core/layers/FeatureLayer').then(m => m.default),
      import('@arcgis/core/layers/support/Field').then(m => m.default),
      import('@arcgis/core/Graphic').then(m => m.default)
    ]);

    // Create fields based on the data structure
    const fields = [
      new Field({ name: 'OBJECTID', type: 'oid', alias: 'Object ID' }),
      new Field({ name: 'area_name', type: 'string', alias: 'Area Name' }),
      new Field({ name: 'value', type: 'double', alias: 'Value' }),
      new Field({ name: 'category', type: 'string', alias: 'Category' }),
      new Field({ name: 'rank', type: 'integer', alias: 'Rank' })
    ];

    // Create features without geometry
    const features = data.records.map((record: any, index: number) => new Graphic({
      attributes: {
        OBJECTID: index + 1,
        area_name: record.area_name || record.area_id || `Area ${index + 1}`,
        value: record.value || 0,
        category: record.category || 'Unknown',
        rank: record.rank || index + 1
      }
    }));

    const featureLayer = new FeatureLayer({
      title: options.title,
      id: `table-analysis-${Date.now()}`,
      fields: fields,
      source: features,
      hasZ: false,
      hasM: false,
      geometryType: null as any, // No geometry
      listMode: 'hide' // FIX: Hide from layer list to prevent layerview creation attempts
    });

    // Mark as analysis layer
    (featureLayer as any).__isAnalysisLayer = true;
    (featureLayer as any).__isTableOnly = true;
    (featureLayer as any).__tableMessage = options.message;
    (featureLayer as any).__suppressLayerViewWarnings = true; // FIX: Flag to suppress layerview warnings

    // FIX: Temporarily suppress console warnings during layer add
    const originalWarn = console.warn;
    const originalError = console.error;
    console.warn = (...args: any[]) => {
      const message = args.join(' ');
      if (message.includes('layerview') || message.includes('LayerView')) {
        // Suppress layerview warnings for table-only layers
        return;
      }
      originalWarn.apply(console, args);
    };
    console.error = (...args: any[]) => {
      const message = args.join(' ');
      if (message.includes('layerview') || message.includes('LayerView')) {
        // Suppress layerview errors for table-only layers
        return;
      }
      originalError.apply(console, args);
    };

    try {
      // Add to map
      mapView?.map.add(featureLayer);
    } finally {
      // Restore console methods after a brief delay to catch async warnings
      setTimeout(() => {
        console.warn = originalWarn;
        console.error = originalError;
      }, 100);
    }

    console.log('[createTableOnlyVisualizationLayer] ✅ Table-only layer created successfully');
    return featureLayer;

  } catch (error) {
    console.error('[createTableOnlyVisualizationLayer] Failed to create table-only layer:', error);
    return null;
  }
}