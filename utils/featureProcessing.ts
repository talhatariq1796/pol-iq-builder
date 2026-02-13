// src/utils/featureProcessing.ts

import Graphic from '@arcgis/core/Graphic';
import type { GeospatialFeature } from '../types/geospatial-ai-types';

interface ProcessedLayerState {
  queryResults?: {
    features: __esri.Graphic[];
    fields: any[];
  };
}

export const processFeatureSet = (features: (GeospatialFeature | Graphic)[]): Graphic[] => {
  return features.map(feature => {
    if (feature instanceof Graphic) return feature;
    return new Graphic({
      geometry: feature.geometry as any,
      attributes: feature.properties || {}
    });
  });
};

export const transformFeatures = (state: ProcessedLayerState): ProcessedLayerState => {
  return {
    ...state,
    queryResults: {
      features: state.queryResults?.features?.map(feature => 
        new Graphic({
          geometry: feature.geometry,
          attributes: feature.attributes
        })
      ) || [],
      fields: state.queryResults?.fields || []
    }
  };
};