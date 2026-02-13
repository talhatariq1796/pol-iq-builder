// adapters/layerConfigAdapter.ts
import { layers as allLayersConfig } from '../config/layers';
// TODO: Re-enable when layers_housing_2025.ts conforms to LayerConfig type
// import { compositeIndexLayerConfigs } from '../config/layers_housing_2025';
import { ProjectLayerConfig, LayerConfig, LayerGroup } from '../types/layers';

/**
 * Creates and returns the project layer configuration.
 * This function dynamically builds the layer and group structure based on the
 * static configuration defined in `config/layers.ts`. It respects the `group`
 * property on each layer to ensure groups are created as specified.
 *
 * @returns {ProjectLayerConfig} The project's layer configuration.
 */
export function createProjectConfig(): ProjectLayerConfig {
  const adaptedLayers: Record<string, LayerConfig> = {};

  // Helper to classify a layer into one of the business groups
  const classifyGroup = (layerName: string, layerConfig: LayerConfig): string => {
    const n = layerName.toLowerCase();
    
    // Use predefined group if it exists (especially for composite index layers)
    if (layerConfig.group && layerConfig.group !== 'general') {
      return layerConfig.group;
    }
    
    // Store locations - Only the actual location layers, not shopping behavior layers
    if (/^target$|^trader joes$|^whole foods$|^costco$/.test(n)) {
      return 'stores';
    }
    
    // Energy Drinks - Primary category for Red Bull, Monster, 5-Hour Energy, etc.
    if (/red bull|energy drink|monster|5-hour|energy|drank.*energy|energy.*drink/.test(n)) {
      return 'energy-drinks';
    }
    
    // Consumer Behavior - Food, beverage consumption, lifestyle activities, purchasing
    if (/drank|bought|purchase|shopping|consume|diet|food|beverage|drink|spent|lifestyle|activity|behavior|buy.*food|organic|sugar-free|low.*fat|healthy/.test(n)) {
      return 'consumer-behavior';
    }
    
    // Demographics - Population, age, generation, race, ethnicity, household characteristics  
    if (/population|total population|diversity|generation|gen |age|white|black|asian|american indian|pacific islander|hispanic|male|female|household|family|residents|demographics/.test(n)) {
      return 'demographics';
    }
    
    // Financial - Income, wealth, spending patterns (relevant for energy drink purchasing power)
    if (/income|disposable|wealth|earnings|salary|median income|financial|economic|spending|money/.test(n)) {
      return 'financial';
    }
    
    // Geographic - ZIP codes and location-based data
    if (/zip|postal|geographic|location|boundary/.test(n)) {
      return 'geographic';
    }
    
    // Fallback to consumer behavior for food/beverage related layers
    return 'consumer-behavior';
  };

  // Helper to remove dates from layer names for display
  const cleanLayerName = (name: string): string => {
    // Remove years (2024, 2025, 2030) from the beginning of layer names
    return name.replace(/^(2024|2025|2030)\s+/, '');
  };

  // Helper to check if layer should be filtered out
  const shouldFilterLayer = (layerName: string): boolean => {
    const n = layerName.toLowerCase();
    
    // Filter out 2024 energy drink layers
    if (n.startsWith('2024') && /energy.*drink|red bull|monster|5-hour/.test(n)) {
      return true;
    }
    
    // Filter out 2024 consumer behavior layers (shopping, purchasing, consumption)
    if (n.startsWith('2024') && /shop|bought|purchase|drank|consume/.test(n)) {
      return true;
    }
    
    // Filter out 2024 and 2030 demographics layers
    if ((n.startsWith('2024') || n.startsWith('2030')) && /population|diversity|generation|age|demographics/.test(n)) {
      return true;
    }
    
    return false;
  };

  // Include composite index layers for Quebec Housing project
  // TODO: Re-enable when layers_housing_2025.ts conforms to LayerConfig type
  // const allLayers = [...Object.values(allLayersConfig), ...compositeIndexLayerConfigs];
  const allLayers = [...Object.values(allLayersConfig)];
  
  for (const layerConfig of allLayers) {
    if (layerConfig && layerConfig.id) {
      const layerName = layerConfig.name || layerConfig.id;
      const layerNameLower = layerName.toLowerCase();
      
      // Filter out layers that should not be displayed
      if (shouldFilterLayer(layerName)) {
        console.log(`[LayerAdapter] Filtering out layer: ${layerName}`);
        continue;
      }
      
      // Hide specific layers that should not be displayed
      if (layerNameLower.includes('h&r block by zip')) {
        console.log(`[LayerAdapter] Hiding layer: ${layerName}`);
        continue; // Skip this layer - don't add it to adaptedLayers
      }
      
      // Special handling for H&R Block points - move to top level and rename
      if (layerNameLower.includes('h&r block points')) {
        console.log(`[LayerAdapter] Moving H&R Block points to top level and renaming`);
        adaptedLayers[layerConfig.id] = { 
          ...layerConfig, 
          name: 'H&R Block Locations',
          group: 'locations', // Special top-level group
          rendererField: undefined // Remove renderer field so it shows as simple points (correct for point layers)
        } as any;
        continue;
      }
      
      const classifiedGroup = classifyGroup(layerName, layerConfig);
      const cleanedName = cleanLayerName(layerName);
      
      // Special name handling for store locations
      let displayName = cleanedName;
      if (classifiedGroup === 'stores') {
        if (layerNameLower === 'target') {
          displayName = 'Target';
        } else if (layerNameLower === 'trader joes') {
          displayName = "Trader Joe's";
        } else if (layerNameLower === 'whole foods') {
          displayName = 'Whole Foods';
        } else if (layerNameLower === 'costco') {
          displayName = 'Costco';
        }
      }
      
      // Store the lowercase id but human title will capitalize later
      const adaptedLayer = { 
        ...layerConfig, 
        name: displayName,
        group: classifiedGroup 
      } as any;
      
      // Debug logging to verify renderer fields are preserved
      if (layerConfig.rendererField) {
        console.log(`[LayerAdapter] ✅ Preserved rendererField '${layerConfig.rendererField}' for layer: ${displayName}`);
      } else {
        console.log(`[LayerAdapter] ⚠️ No rendererField for layer: ${displayName}`);
      }
      
      adaptedLayers[layerConfig.id] = adaptedLayer;
    }
  }

  // Next, discover all unique group IDs from the `group` property of the layers.
  const groupData: Record<string, { title: string; layers: LayerConfig[] }> = {};

  for (const layer of Object.values(adaptedLayers)) {
    const groupId = layer.group;
    if (!groupId) {
      // Skip layers that don't have a group defined.
      continue;
    }

    if (!groupData[groupId]) {
      // This is the first time we've seen this group ID. Initialize it.
      // Use specific titles for Red Bull Energy Drinks project groups
      let title: string;
      switch (groupId) {
        case 'stores':
          title = 'Stores';
          break;
        case 'composite-indexes':
          title = 'Composite Indexes';
          break;
        case 'energy-drinks':
          title = 'Energy Drinks';
          break;
        case 'consumer-behavior':
          title = 'Consumer Behavior';
          break;
        case 'demographics':
          title = 'Demographics';
          break;
        case 'financial':
          title = 'Financial';
          break;
        case 'geographic':
          title = 'Geographic Data';
          break;
        case 'locations':
          title = 'Locations';
          break;
        case 'properties':
          title = 'Properties';
          break;
        default:
          // For any other groups, convert ID to title
          title = groupId
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, char => char.toUpperCase());
      }

      groupData[groupId] = {
        title: title,
        layers: [],
      };
    }
    // Add the current layer to its group.
    groupData[groupId].layers.push(layer);
  }

  // Now, transform the collected groupData into the final LayerGroup array.
  // First create all groups
  const allGroups: LayerGroup[] = Object.entries(groupData).map(([id, data]) => ({
    id: id,
    title: data.title,
    description: `${data.title} data`,
    layers: data.layers,
  }));

  // Sort groups with point layers first, then target variable and competitors, then logical order
  const groups: LayerGroup[] = allGroups.sort((a, b) => {
    // Check if groups have point layers (these should always be first)
    const aHasPointLayers = a.layers?.some(layer => layer.type === 'point') || false;
    const bHasPointLayers = b.layers?.some(layer => layer.type === 'point') || false;
    
    if (aHasPointLayers && !bHasPointLayers) return -1; // Point layers first
    if (!aHasPointLayers && bHasPointLayers) return 1;
    
    // If both or neither have point layers, use priority order for project
    const priority: Record<string, number> = {
      'properties': 1,         // First - real estate properties
      'stores': 2,             // Second - store locations
      'composite-indexes': 3,  // Third - composite index layers
      'energy-drinks': 4,      // Fourth - target variable and competitors
      'consumer-behavior': 5,  // Fifth - related consumption patterns
      'demographics': 6,       // Sixth - target audience data
      'financial': 7,          // Seventh - purchasing power data
      'geographic': 8,         // Eighth - location data
      'locations': 9           // Last - generic location layers
    };
    
    const aPriority = priority[a.id] || 999;
    const bPriority = priority[b.id] || 999;
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    // If same priority, sort alphabetically
    return a.title.localeCompare(b.title);
  });

  // Set the default visibility for all layers to hidden.
  const defaultVisibility: { [key: string]: boolean } = {};
  Object.keys(adaptedLayers).forEach(layerId => {
    defaultVisibility[layerId] = false;
  });

  // Set the default collapsed state for all groups to collapsed.
  const defaultCollapsed: Record<string, boolean> = {};
  groups.forEach(group => {
    defaultCollapsed[group.id] = true; // All groups start collapsed
  });

  // Log the final generated structure for debugging.
  console.log('[Adapter] Final generated config:', {
    layerCount: Object.keys(adaptedLayers).length,
    groupCount: groups.length,
    groups: Object.fromEntries(groups.map(g => [g.id, g.layers?.length ?? 0])),
  });

  return {
    layers: adaptedLayers,
    groups: groups,
    defaultVisibility,
    defaultCollapsed,
    globalSettings: {
      defaultOpacity: 0.8,
      maxVisibleLayers: 10,
      performanceMode: 'standard',
    },
  };
}