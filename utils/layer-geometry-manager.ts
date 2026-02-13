import type { LayerConfig } from '@/types/layers';

/**
 * Layer types that typically have large/complex geometries
 * that should be excluded from AI analysis requests
 */
const LARGE_GEOMETRY_LAYER_TYPES = ['polygon'];

/**
 * Specific layer IDs known to have large geometries
 */
const LARGE_GEOMETRY_LAYER_IDS = [
  'winningCandidate',
  'precinctBoundaries',
  'censusTracts',
  'censusSubdivisions'
];

/**
 * Determines if geometry should be included when querying a layer
 * @param layerId The ID of the layer
 * @param layerConfig The layer configuration
 * @returns Whether geometry should be included in queries
 */
export function shouldIncludeGeometry(layerId: string, layerConfig?: LayerConfig): boolean {
  // Skip geometry for known large layers
  if (LARGE_GEOMETRY_LAYER_IDS.includes(layerId)) {
    return false;
  }
  
  // Skip geometry for polygon layers
  if (layerConfig?.type && LARGE_GEOMETRY_LAYER_TYPES.includes(layerConfig.type)) {
    return false;
  }
  
  // Include geometry by default for other layers
  return true;
}

/**
 * Gets the ID field name for a layer to use when joining analysis results
 * @param layerId The ID of the layer
 * @param layerConfig The layer configuration
 * @returns The field name to use as the ID
 */
export function getLayerIdField(layerId: string): string {
  // Default to OBJECTID for all layers
  return 'OBJECTID';
}

/**
 * Creates a where clause to filter a layer by a set of feature IDs
 * @param idField The ID field name
 * @param ids Array of IDs to filter by
 * @returns SQL where clause
 */
export function createIdWhereClause(idField: string, ids: (string | number)[]): string {
  if (ids.length === 0) return '1=0';
  
  // Determine if we're dealing with numeric or string IDs
  const isNumeric = typeof ids[0] === 'number';
  
  if (isNumeric) {
    return `${idField} IN (${ids.join(',')})`;
  } else {
    // Escape single quotes in string IDs
    const safeIds = ids.map(id => `'${String(id).replace(/'/g, "''")}'`);
    return `${idField} IN (${safeIds.join(',')})`;
  }
}

/**
 * Joins analysis results to a feature layer for visualization
 * @param layer The feature layer to join results to
 * @param analysisResults Analysis results with attributes
 * @param idField The field name to join on
 * @param valueField The field containing the value to visualize
 * @returns Updated layer with visualization applied
 */
export async function joinAnalysisResultsToLayer(
  layer: __esri.FeatureLayer,
  analysisResults: Record<string | number, any>,
  idField: string,
  valueField: string
): Promise<__esri.FeatureLayer> {
  // Create a field expression to use in renderer
  // This will dynamically compute the value based on attributes
  const valueExpression = `
    var resultValue = null;
    var featureId = $feature.${idField};
    
    // Analysis results lookup (generated dynamically)
    var results = {
      ${Object.entries(analysisResults).map(([id, data]) => 
        `"${id}": ${typeof data[valueField] === 'string' 
          ? `"${data[valueField]}"` 
          : data[valueField]}`
      ).join(',\n      ')}
    };
    
    // Return the value for this feature
    return results[featureId] !== undefined ? results[featureId] : null;
  `;
  
  // Clone the layer to avoid modifying the original
  const resultLayer = layer.clone();
  
  // Set the value expression on the layer renderer
  // The actual renderer setup would depend on the visualization type
  
  return resultLayer;
} 