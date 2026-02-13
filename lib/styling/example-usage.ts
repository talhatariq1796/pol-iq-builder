import { EnhancedStylingManager } from './enhanced-styling-manager';
import { getStylingPreset, createCustomPreset } from './presets/styling-presets';
import { GlobalStylingConfig, LayerStylingConfig } from './types';

/**
 * Example usage of the Enhanced Styling System
 * 
 * This file demonstrates how to:
 * - Initialize the styling manager
 * - Apply different presets to layers
 * - Create custom styling configurations
 * - Update styling dynamically
 */

// Example 1: Basic initialization and usage
export async function basicStylingExample(mapView: __esri.MapView) {
  // Create global configuration
  const globalConfig: GlobalStylingConfig = {
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
      monitoring: true,
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
      available: ['default', 'premium', 'correlation', 'hotspot', 'cluster']
    },
    defaults: {
      point: { color: '#3388ff', opacity: 0.8 },
      polygon: { color: '#3388ff', opacity: 0.8 },
      line: { color: '#3388ff', opacity: 0.8 }
    }
  };

  // Initialize the styling manager
  const stylingManager = new EnhancedStylingManager(globalConfig);
  await stylingManager.initialize(mapView);

  return stylingManager;
}

// Example 2: Apply different presets to layers
export async function applyPresetsExample(
  stylingManager: EnhancedStylingManager,
  layers: __esri.FeatureLayer[]
) {
  const presets = ['default', 'premium', 'correlation', 'hotspot', 'cluster'];
  
  for (let i = 0; i < layers.length && i < presets.length; i++) {
    const layer: __esri.FeatureLayer = layers[i];
    const presetName = presets[i];
    
    // Get the preset configuration
    const presetConfig = getStylingPreset(presetName);
    
    // Apply the preset to the layer
    await stylingManager.applyStylingToLayer(layer, presetConfig);
    
    console.log(`Applied ${presetName} preset to layer ${layer.id}`);
  }
}

// Example 3: Create custom styling configuration
export function createCustomStylingExample() {
  // Start with a base preset
  const baseConfig = getStylingPreset('premium');
  
  // Create custom configuration with overrides
  const customConfig = createCustomPreset('premium', {
    baseStyle: {
      color: '#ff6b35', // Custom color
      opacity: 0.9
    },
    fireflyEffects: {
      enabled: true,
      intensity: 0.8,
      color: '#ff6b35',
      particleSize: 3,
      glowRadius: 6,
      orbitSpeed: 0.02,
      pulseSpeed: 0.05,
      maxParticles: 75,
      triggerThreshold: 75,
      fadeDistance: 100
    },
    animations: {
      entry: {
        type: 'bounce',
        duration: 800,
        easing: 'ease-out'
      }
    }
  });
  
  return customConfig;
}

// Example 4: Dynamic styling updates
export async function dynamicStylingExample(
  stylingManager: EnhancedStylingManager,
  layerId: string
) {
  // Update base style
  await stylingManager.updateLayerStyling(layerId, {
    baseStyle: {
      color: '#e74c3c',
      opacity: 0.9
    }
  });
  
  // Update effects
  await stylingManager.updateLayerStyling(layerId, {
    fireflyEffects: {
      enabled: true,
      intensity: 0.9,
      color: '#e74c3c',
      particleSize: 4,
      glowRadius: 8,
      orbitSpeed: 0.03,
      pulseSpeed: 0.06,
      maxParticles: 100,
      triggerThreshold: 60,
      fadeDistance: 120
    }
  });
  
  // Animate transition to a new configuration
  const targetConfig = getStylingPreset('hotspot');
  await stylingManager.animateLayerTransition(layerId, targetConfig, 1000);
}

// Example 5: Analysis-specific styling
export function createAnalysisStyling(analysisType: string, confidence: number) {
  let basePreset = 'default';
  
  // Choose preset based on analysis type
  switch (analysisType) {
    case 'correlation':
      basePreset = 'correlation';
      break;
    case 'hotspot':
      basePreset = 'hotspot';
      break;
    case 'cluster':
      basePreset = 'cluster';
      break;
    case 'trend':
      basePreset = 'trend';
      break;
    case 'outlier':
      basePreset = 'outlier';
      break;
    default:
      basePreset = 'default';
  }
  
  const baseConfig = getStylingPreset(basePreset);
  
  // Enhance based on confidence level
  const enhancedConfig = createCustomPreset(basePreset, {
    fireflyEffects: confidence > 0.8 ? {
      enabled: true,
      intensity: 0.8 + (confidence - 0.8) * 0.2, // Scale intensity with confidence
      color: '#ffd700',
      particleSize: 3,
      glowRadius: 6,
      orbitSpeed: 0.02,
      pulseSpeed: 0.05,
      maxParticles: Math.floor(50 + confidence * 50),
      triggerThreshold: 75,
      fadeDistance: 100
    } : undefined,
    animations: {
      continuous: {
        pulse: confidence > 0.7 ? {
          enabled: true,
          duration: 2000 - confidence * 500, // Faster pulse for higher confidence
          scale: 1.1 + confidence * 0.2
        } : undefined
      }
    }
  });
  
  return enhancedConfig;
}

// Example 6: Performance monitoring
export function monitorPerformance(stylingManager: EnhancedStylingManager) {
  // Get performance statistics
  const stats = stylingManager.getPerformanceStats();
  
  console.log('Styling Performance Stats:', {
    totalLayers: stats.totalLayers,
    effectsStats: stats.effectsStats,
    layers: stats.layers.map((layer: any) => ({
      id: layer.id,
      isAnimating: layer.isAnimating
    }))
  });
  
  return stats;
}

// Example 7: Complete workflow
export async function completeStylingWorkflow(
  mapView: __esri.MapView,
  layers: __esri.FeatureLayer[]
) {
  console.log('Starting Enhanced Styling Workflow...');
  
  // Step 1: Initialize styling manager
  const stylingManager = await basicStylingExample(mapView);
  console.log('✓ Styling manager initialized');
  
  // Step 2: Apply presets to layers
  await applyPresetsExample(stylingManager, layers);
  console.log('✓ Presets applied to layers');
  
  // Step 3: Create custom styling for specific analysis
  const customConfig = createCustomStylingExample();
  console.log('✓ Custom styling configuration created');
  
  // Step 4: Apply custom styling to a specific layer
  if (layers.length > 0) {
    await stylingManager.applyStylingToLayer(layers[0], customConfig);
    console.log('✓ Custom styling applied to first layer');
  }
  
  // Step 5: Monitor performance
  const performanceStats = monitorPerformance(stylingManager);
  console.log('✓ Performance monitoring active');
  
  // Step 6: Create analysis-specific styling
  const analysisConfig = createAnalysisStyling('correlation', 0.85);
  console.log('✓ Analysis-specific styling created');
  
  // Step 7: Apply analysis styling with animation
  if (layers.length > 1) {
    await stylingManager.animateLayerTransition(layers[1].id, analysisConfig, 1500);
    console.log('✓ Analysis styling applied with animation');
  }
  
  console.log('Enhanced Styling Workflow completed successfully!');
  
  return {
    stylingManager,
    performanceStats,
    customConfig,
    analysisConfig
  };
}

// Example 8: Cleanup
export function cleanupStyling(stylingManager: EnhancedStylingManager) {
  stylingManager.destroy();
  console.log('✓ Styling system cleaned up');
}

// Export all examples for easy access
export const EnhancedStylingExamples = {
  basicStylingExample,
  applyPresetsExample,
  createCustomStylingExample,
  dynamicStylingExample,
  createAnalysisStyling,
  monitorPerformance,
  completeStylingWorkflow,
  cleanupStyling
}; 