import React from 'react';
import { EnhancedStylingManager } from '../enhanced-styling-manager';
import { createLayerControllerIntegration } from './layer-controller-integration';
import { GlobalStylingConfig } from '../types';
import { ProjectLayerConfig } from '../../../types/layers';

/**
 * Example: How to integrate Enhanced Styling with existing LayerController
 * 
 * This example shows how to:
 * 1. Initialize the enhanced styling system
 * 2. Create the integration layer
 * 3. Hook into the existing layer creation process
 * 4. Apply enhanced styling automatically
 */

export class EnhancedStylingIntegrationExample {
  private stylingManager: EnhancedStylingManager;
  private integration: ReturnType<typeof createLayerControllerIntegration>;

  constructor(mapView: __esri.MapView, globalConfig?: Partial<GlobalStylingConfig>) {
    // Initialize the enhanced styling manager
    const config = globalConfig ? { ...this.getDefaultConfig(), ...globalConfig } : this.getDefaultConfig();
    this.stylingManager = new EnhancedStylingManager(config);
    
    // Create the integration layer
    this.integration = createLayerControllerIntegration(this.stylingManager, config);
    
    // Initialize the styling manager with the map view
    this.initialize(mapView);
  }

  /**
   * Initialize the styling system
   */
  private async initialize(mapView: __esri.MapView): Promise<void> {
    try {
      await this.stylingManager.initialize(mapView);
      console.log('[EnhancedStylingIntegrationExample] Styling system initialized');
    } catch (error) {
      console.error('[EnhancedStylingIntegrationExample] Failed to initialize styling system:', error);
    }
  }

  /**
   * Hook into the existing createEnhancedLayer function
   * This should be called after layer creation but before adding to map
   */
  async enhanceLayerAfterCreation(
    layer: __esri.FeatureLayer,
    layerConfig: any, // LayerConfig type
    projectConfig: ProjectLayerConfig
  ): Promise<void> {
    try {
      await this.integration.integrateLayerCreation(layer, layerConfig, projectConfig);
    } catch (error) {
      console.error('[EnhancedStylingIntegrationExample] Failed to enhance layer:', error);
      // Don't throw - we want layer creation to continue
    }
  }

  /**
   * Update layer styling when configuration changes
   */
  async updateLayerStyling(
    layerId: string,
    layerConfig: any, // LayerConfig type
    projectConfig: ProjectLayerConfig
  ): Promise<void> {
    try {
      await this.integration.updateLayerStyling(layerId, layerConfig, projectConfig);
    } catch (error) {
      console.error('[EnhancedStylingIntegrationExample] Failed to update layer styling:', error);
    }
  }

  /**
   * Animate layer to a different preset
   */
  async animateLayerToPreset(
    layerId: string,
    presetName: string,
    duration: number = 1000
  ): Promise<void> {
    try {
      await this.integration.animateLayerStyling(layerId, presetName, duration);
    } catch (error) {
      console.error('[EnhancedStylingIntegrationExample] Failed to animate layer:', error);
    }
  }

  /**
   * Get styling statistics
   */
  getStylingStats() {
    return this.integration.getStylingStats();
  }

  /**
   * Get all styled layers
   */
  getAllStyledLayers() {
    return this.integration.getAllStyledLayers();
  }

  /**
   * Cleanup when component unmounts
   */
  cleanup(): void {
    // The styling manager will handle cleanup of its own resources
    console.log('[EnhancedStylingIntegrationExample] Cleanup completed');
  }

  /**
   * Default configuration
   */
  private getDefaultConfig(): GlobalStylingConfig {
    return {
      effects: {
        enabled: true,
        performance: 'auto',
        fireflies: { enabled: true, intensity: 0.7 },
        gradients: true,
        hover: { enabled: true, scale: 1.2 },
        ambient: { enabled: true, density: 0.3 },
        coordinateEffects: true
      },
      performance: {
        adaptive: true,
        monitoring: false,
        thresholds: {
          maxFrameTime: 16.67,
          maxMemoryUsage: 100 * 1024 * 1024,
          maxParticleCount: 1000,
          maxGradientComplexity: 5
        },
        optimization: {
          autoOptimize: true,
          reduceParticles: true,
          simplifyGradients: true,
          disableComplexAnimations: false
        }
      },
      themes: {
        default: 'default',
        available: ['default', 'premium', 'correlation', 'hotspot', 'cluster', 'trend', 'outlier', 'comparison']
      },
      defaults: {
        point: { color: '#3388ff', opacity: 0.8 },
        polygon: { color: '#3388ff', opacity: 0.8 },
        line: { color: '#3388ff', opacity: 0.8 }
      }
    };
  }
}

/**
 * Example: How to modify the existing createEnhancedLayer function
 * 
 * Add this to your existing createEnhancedLayer function:
 */
export function createEnhancedLayerWithStyling(
  layerConfig: any, // LayerConfig type
  layerGroups: any[], // LayerGroup[] type
  view: __esri.MapView,
  layerStates: any, // LayerStatesMap type
  stylingIntegration?: EnhancedStylingIntegrationExample
): Promise<[__esri.FeatureLayer | null, any[]]> {
  return new Promise(async (resolve) => {
    try {
      // Your existing layer creation logic here
      // ... existing code ...
      
      // After layer is created but before returning:
      // if (stylingIntegration && layer) {
      //   // Get project config (you'll need to pass this or get it from context)
      //   const projectConfig = {} as any; // ProjectLayerConfig type
      //   
      //   // Apply enhanced styling
      //   await stylingIntegration.enhanceLayerAfterCreation(layer, layerConfig, projectConfig);
      // }
      
      // Return the layer as before
      // resolve([layer, features]);
      resolve([null, []]);
    } catch (error) {
      console.error('Error in createEnhancedLayerWithStyling:', error);
      resolve([null, []]);
    }
  });
}

/**
 * Example: How to use in a React component
 */
export function useEnhancedStylingIntegration(
  mapView: __esri.MapView | null,
  globalConfig?: Partial<GlobalStylingConfig>
): EnhancedStylingIntegrationExample | null {
  const [integration, setIntegration] = React.useState(null as EnhancedStylingIntegrationExample | null);

  React.useEffect(() => {
    if (mapView && !integration) {
      const newIntegration = new EnhancedStylingIntegrationExample(mapView, globalConfig);
      setIntegration(newIntegration);
    }

    return () => {
      if (integration) {
        integration.cleanup();
      }
    };
  }, [mapView, globalConfig]);

  return integration;
}

/**
 * Example: How to integrate with LayerController component
 * 
 * In your LayerController component, add this:
 */
export function integrateWithLayerController(
  layerControllerRef: any, // LayerControllerRef type
  stylingIntegration: EnhancedStylingIntegrationExample
): void {
  // Hook into layer state changes
  const originalOnLayerStatesChange = layerControllerRef.current?.onLayerStatesChange;
  
  layerControllerRef.current.onLayerStatesChange = (newStates: any) => {
    // Call original handler
    if (originalOnLayerStatesChange) {
      originalOnLayerStatesChange(newStates);
    }
    
    // Apply enhanced styling to new layers
    Object.entries(newStates).forEach(([layerId, state]: [string, any]) => {
      if (state.layer && !state.layer._enhancedStylingApplied) {
        // Mark as styled to prevent duplicate application
        state.layer._enhancedStylingApplied = true;
        
        // Get layer config and project config (you'll need to pass these)
        const layerConfig = {} as any; // LayerConfig type
        const projectConfig = {} as any; // ProjectLayerConfig type
        
        // Apply enhanced styling
        stylingIntegration.enhanceLayerAfterCreation(state.layer, layerConfig, projectConfig);
      }
    });
  };
} 