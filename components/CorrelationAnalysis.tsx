import React, { useState, useEffect } from 'react';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import SceneView from '@arcgis/core/views/SceneView';
import { CorrelationAnalysisPanel } from './CorrelationAnalysisPanel';
import { CorrelationMapControls } from './CorrelationMapControls';
import { handleCrossGeographyQuery } from '../utils/geospatial-ai/handleCrossGeographyQueries';

/**
 * Maps technical field names to human-readable names
 */
const getHumanReadableFieldName = (fieldName: string): string => {
  const fieldMappings: { [key: string]: string } = {
    // Brand purchase fields
    'MP30034A_B': 'Nike Athletic Shoes Purchases',
    'mp30034a_b': 'Nike Athletic Shoes Purchases',
    'MP30029A_B': 'Adidas Athletic Shoes Purchases', 
    'mp30029a_b': 'Adidas Athletic Shoes Purchases',
    'MP30030A_B': 'Asics Athletic Shoes Purchases',
    'mp30030a_b': 'Asics Athletic Shoes Purchases',
    'MP30031A_B': 'Converse Athletic Shoes Purchases',
    'mp30031a_b': 'Converse Athletic Shoes Purchases',
    'MP30032A_B': 'Jordan Athletic Shoes Purchases',
    'mp30032a_b': 'Jordan Athletic Shoes Purchases',
    'MP30033A_B': 'New Balance Athletic Shoes Purchases',
    'mp30033a_b': 'New Balance Athletic Shoes Purchases',
    'MP30035A_B': 'Puma Athletic Shoes Purchases',
    'mp30035a_b': 'Puma Athletic Shoes Purchases',
    'MP30036A_B': 'Reebok Athletic Shoes Purchases',
    'mp30036a_b': 'Reebok Athletic Shoes Purchases',
    'MP30037A_B': 'Skechers Athletic Shoes Purchases',
    'mp30037a_b': 'Skechers Athletic Shoes Purchases',
    'MP30016A_B': 'Athletic Shoes Purchases',
    'mp30016a_b': 'Athletic Shoes Purchases',
    // Demographics
    'TOTPOP_CY': 'Total Population',
    'totpop_cy': 'Total Population',
    'MEDDI_CY': 'Median Household Income',
    'meddi_cy': 'Median Household Income',
    'DIVINDX_CY': 'Diversity Index',
    'divindx_cy': 'Diversity Index',
    // Sports participation
    'MP33020A_B': 'Running/Jogging Participation',
    'mp33020a_b': 'Running/Jogging Participation',
    'MP33032A_B': 'Yoga Participation',
    'mp33032a_b': 'Yoga Participation',
    // Retail
    'MP31035A_B': "Dick's Sporting Goods Shopping",
    'mp31035a_b': "Dick's Sporting Goods Shopping",
    'MP31042A_B': 'Foot Locker Shopping',
    'mp31042a_b': 'Foot Locker Shopping'
  };

  // Check direct mappings first
  if (fieldMappings[fieldName]) {
    return fieldMappings[fieldName];
  }

  // Fallback: convert snake_case or camelCase to Title Case
  return fieldName
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

interface CorrelationAnalysisProps {
  primaryLayer: FeatureLayer;
  primaryField: string;
  comparisonLayer: FeatureLayer;
  comparisonField: string;
  map: Map;
  view: MapView | SceneView;
  onClose: () => void;
}

export const CorrelationAnalysis: React.FC<CorrelationAnalysisProps> = ({
  primaryLayer,
  primaryField,
  comparisonLayer,
  comparisonField,
  map,
  view,
  onClose
}) => {
  const [correlationResult, setCorrelationResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const calculateCorrelation = async () => {
      try {
        setLoading(true);
        
        // Convert field names to human-readable names for the query
        const primaryFieldName = getHumanReadableFieldName(primaryField);
        const comparisonFieldName = getHumanReadableFieldName(comparisonField);
        
        // Use the cross-geography query handler which uses the specific feature service
        const success = await handleCrossGeographyQuery(
          `Compare ${primaryFieldName} with ${comparisonFieldName}`,
          map,
          view
        );

        if (!success) {
          throw new Error('Failed to perform cross-geography analysis');
        }

        // The correlation result will be available in the layer's attributes
        const features = await primaryLayer.queryFeatures();
        const correlationValue = features.features[0]?.attributes?.correlationValue;
        
        setCorrelationResult({
          pearson: correlationValue,
          spearman: null, // These would be calculated if needed
          kendall: null,
          pValue: null,
          spatialStats: null
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to calculate correlation');
      } finally {
        setLoading(false);
      }
    };

    calculateCorrelation();
  }, [primaryLayer, primaryField, comparisonLayer, comparisonField, map, view]);

  return (
    <div className="fixed bottom-0 right-0 w-full h-[50%] z-[9999]">
      <div className="h-full px-4 py-2 bg-white border-t border-gray-200">
        <CorrelationAnalysisPanel
          primaryLayer={primaryLayer}
          primaryField={primaryField}
          comparisonLayer={comparisonLayer}
          comparisonField={comparisonField}
          onClose={onClose}
          correlationResult={correlationResult}
          loading={loading}
          error={error}
        />
        <CorrelationMapControls
          layer={primaryLayer}
          primaryField={primaryField}
          comparisonField={comparisonField}
          onFieldChange={() => {}}
          onComparisonFieldChange={() => {}}
          onClose={onClose}
          correlationResult={correlationResult}
          loading={loading}
          error={error}
        />
      </div>
    </div>
  );
}; 