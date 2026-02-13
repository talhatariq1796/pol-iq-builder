import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer";
import { LayerConfig } from "@/types/layers";
import { LayerGroup } from "@/types/layers";
import { VisualizationType } from "@/config/dynamic-layers";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";

class LayerController {
  private layerStates: { [key: string]: { layer: __esri.FeatureLayer | null } } = {};
  private layerGroups: LayerGroup[] = [];

  private createFeatureLayer(layerConfig: LayerConfig): __esri.FeatureLayer {
    const rendererConfig = layerConfig.metadata?.rendererConfig;
    const renderer = rendererConfig ? new UniqueValueRenderer({
      field: rendererConfig.field,
      uniqueValueInfos: Object.entries(rendererConfig.colors || {}).map(([value, color]) => ({
        value,
        symbol: new SimpleMarkerSymbol({
          color: color,
          outline: {
            color: [255, 255, 255],
            width: 1
          }
        })
      }))
    }) : undefined;

    // Special handling for winning candidate layer
    if (layerConfig.id === 'winningCandidate') {
      return new FeatureLayer({
        url: layerConfig.url,
        outFields: ["*"],
        definitionExpression: layerConfig.definitionExpression,
        renderer,
        // High quality rendering settings for electoral districts
        featureReduction: undefined, // Disable feature reduction
        effect: "bloom(1.5, 0.5px, 0.1)"
      });
    }

    // Default settings for other layers
    const layer = new FeatureLayer({
      url: layerConfig.url,
      outFields: ["*"],
      definitionExpression: layerConfig.definitionExpression,
      renderer,
      featureReduction: {
        type: "cluster",
        clusterRadius: "100px"
      },
      effect: "bloom(1.5, 0.5px, 0.1)"
    });

    return layer;
  }

  private async initializeLayers() {
    const newLayerStates: { [key: string]: { layer: __esri.FeatureLayer | null } } = {};
    const layerPromises: Promise<void>[] = [];

    // Process all layers including those in subgroups
    const processLayer = async (layerConfig: LayerConfig, groupId: string) => {
      try {
        console.log(`Initializing layer: ${layerConfig.name} (${layerConfig.id})`, {
          isGoogleTrends: layerConfig.id.includes('google-trends'),
          group: groupId
        });
        
        // Special handling for Google Trends layers
        if (layerConfig.id.includes('google-trends')) {
          console.log(`Processing Google Trends layer: ${layerConfig.name}`);
          const layer = await this.createFeatureLayer(layerConfig);
          if (layer) {
            newLayerStates[layerConfig.id] = { layer };
            console.log(`Successfully initialized Google Trends layer: ${layerConfig.name}`);
          } else {
            console.warn(`Failed to create Google Trends layer: ${layerConfig.name}`);
            newLayerStates[layerConfig.id] = { layer: null };
          }
          return;
        }

        const layer = await this.createFeatureLayer(layerConfig);
        if (layer) {
          newLayerStates[layerConfig.id] = { layer };
          console.log(`Successfully initialized layer: ${layerConfig.name}`);
        } else {
          console.warn(`Failed to create layer: ${layerConfig.name}`);
          newLayerStates[layerConfig.id] = { layer: null };
        }
      } catch (error) {
        console.error(`Error initializing layer ${layerConfig.name}:`, error);
        newLayerStates[layerConfig.id] = { layer: null };
      }
    };

    // Process main layers
    this.layerGroups.forEach(group => {
      group.layers?.forEach((layer: LayerConfig) => {
        layerPromises.push(processLayer(layer, group.id));
      });

      // Process layers in subgroups
      group.subGroups?.forEach((subGroup: LayerGroup) => {
        console.log(`Processing subgroup: ${subGroup.id}`, {
          layerCount: subGroup.layers?.length || 0,
          isGoogleTrends: group.id === 'google-trends-group'
        });

        subGroup.layers?.forEach((layer: LayerConfig) => {
          layerPromises.push(processLayer(layer, group.id));
        });
      });
    });

    // Wait for all layers to initialize
    await Promise.all(layerPromises);
    this.layerStates = newLayerStates;
    
    // Log final state of Google Trends layers
    const googleTrendsLayers = Object.entries(newLayerStates)
      .filter(([_, state]) => state.layer?.title?.includes('google-trends'))
      .map(([id, state]) => ({
        id,
        hasLayer: !!state.layer,
        layerLoaded: state.layer ? state.layer.loaded : false
      }));

    console.log('Layer initialization complete', {
      totalLayers: Object.keys(newLayerStates).length,
      googleTrendsLayers: googleTrendsLayers.length,
      layers: googleTrendsLayers
    });
  }

  private async initializeGoogleTrendsLayers(region: 'ON' | 'BC') {
    const newLayerStates = { ...this.layerStates };

    const googleTrendsGroup = this.layerGroups.find(group => group.id === 'google-trends-group');
    if (!googleTrendsGroup) {
      console.warn('Google Trends group not found');
      return;
    }

    const layerPromises: Promise<void>[] = [];

    // Process all Google Trends layers for the specified region
    const processLayer = async (layerConfig: LayerConfig) => {
      if (!layerConfig.id.endsWith(region)) return;

      try {
        console.log(`Initializing Google Trends layer: ${layerConfig.name}`);
        const layer = await this.createFeatureLayer(layerConfig);
        if (layer) {
          newLayerStates[layerConfig.id] = { layer };
          console.log(`Successfully initialized Google Trends layer: ${layerConfig.name}`);
        } else {
          console.warn(`Failed to create Google Trends layer: ${layerConfig.name}`);
          newLayerStates[layerConfig.id] = { layer: null };
        }
      } catch (error) {
        console.error(`Error initializing Google Trends layer ${layerConfig.name}:`, error);
        newLayerStates[layerConfig.id] = { layer: null };
      }
    };

    // Process layers in all subgroups
    googleTrendsGroup.subGroups?.forEach((subGroup: { layers?: LayerConfig[] }) => {
      subGroup.layers?.forEach((layer: LayerConfig) => {
        layerPromises.push(processLayer(layer));
      });
    });

    // Wait for all Google Trends layers to initialize
    await Promise.all(layerPromises);
    this.layerStates = newLayerStates;
    console.log(`Google Trends layer initialization complete for region: ${region}`);
  }

  private async handleLayerClick(layerId: string) {
    // Initialize Google Trends layers if the clicked layer is a Google Trends layer
    if (layerId.includes('google-trends')) {
      const region = layerId.endsWith('ON') ? 'ON' : 'BC';
      await this.initializeGoogleTrendsLayers(region);
    }

    // ... rest of existing handleLayerClick code ...
  }

  // ... rest of existing class methods ...
}

export default LayerController; 