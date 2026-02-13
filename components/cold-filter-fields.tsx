import type { LayerState } from './types';

export interface FilterField {
  value: string;
  label: string;
  description: string;
  type: string;
  category?: string;
  layerId: string;
}

export interface LayerConfig {
  id: string;
  title: string;
  description: string;
  url: string;
  fields: {
    index?: string;
    type?: 'point';
    fields?: string[];
  };
}

export const LAYER_GROUPS = [
  {
    id: 'spending',
    title: 'Spending',
    layers: [
      {
        id: 'sports-equipment',
        title: 'Sports and Exercise Equipment',
        description: 'Index of spending on sports and exercise equipment',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__1025f3822c784873/FeatureServer/1',
        fields: {
          index: 'X9051_X_I'
        }
      },
      {
        id: 'workout-wear',
        title: 'Spent $100+ on Workout/Athletic Wear',
        description: 'Index of population that spent over $100 on workout wear',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__1025f3822c784873/FeatureServer/3',
        fields: {
          index: 'MP07111A_B_I'
        }
      },
      {
        id: 'fitness-apparel',
        title: 'Ordered Fitness Apparel/Equipment Online',
        description: 'Index of population that ordered fitness items online',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__1025f3822c784873/FeatureServer/4',
        fields: {
          index: 'MP31191A_B_I'
        }
      }
    ]
  },
  {
    id: 'psychographics',
    title: 'Psychographics',
    layers: [
      {
        id: 'exercise-daily',
        title: 'Make Sure I Exercise Daily',
        description: 'Index showing population that exercises daily',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__1025f3822c784873/FeatureServer/0',
        fields: {
          index: 'MP28646A_B_I'
        }
      },
      {
        id: 'more-fit-active',
        title: 'More Fit/Active Than My Peers',
        description: 'Index showing population that is more fit/active than peers',
        url: 'https://services8.arcgis.com/VhrZdFGa39zmfR47/arcgis/rest/services/Synapse54__1025f3822c784873/FeatureServer/2',
        fields: {
          index: 'MP28650A_B_I'
        }
      }
    ]
  }
] as const;

// Get all available fields from layer configurations
export const getAllLayerFields = (): FilterField[] => {
  const fields: FilterField[] = [];

  LAYER_GROUPS.forEach(group => {
    group.layers.forEach(layerConfig => {
      if (!layerConfig.fields) return;

      // Handle index fields
      if (layerConfig.fields.index) {
        fields.push({
          value: layerConfig.fields.index,
          label: `${layerConfig.title} - Index`,
          description: `Index value for ${layerConfig.description}`,
          type: 'number',
          category: group.title,
          layerId: layerConfig.id
        });
      }
    });
  });

  return fields.sort((a, b) => {
    // Sort by category then label
    if (a.category !== b.category) {
      return (a.category || '').localeCompare(b.category || '');
    }
    return a.label.localeCompare(b.label);
  });
};

export const findLayerConfigByUrl = (url: string): LayerConfig | undefined => {
  for (const group of LAYER_GROUPS) {
    const config = group.layers.find(layer => layer.url === url);
    if (config) return config;
  }
  return undefined;
};

export const findLayerConfigById = (id: string): LayerConfig | undefined => {
  for (const group of LAYER_GROUPS) {
    const config = group.layers.find(layer => layer.id === id);
    if (config) return config;
  }
  return undefined;
};