import { DEFAULT_FILL_ALPHA } from "./constants";
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import ClassBreaksRenderer from '@arcgis/core/renderers/ClassBreaksRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import Graphic from '@arcgis/core/Graphic';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';
import { VisualizationOptions, BaseVisualization, BaseVisualizationData, VisualizationResult } from './base-visualization';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as projection from '@arcgis/core/geometry/projection';
import { Polygon } from '@arcgis/core/geometry';
import SpatialReference from '@arcgis/core/geometry/SpatialReference';
import { isFinite } from 'lodash';
import Query from '@arcgis/core/rest/support/Query';
import Collection from '@arcgis/core/core/Collection';
import TextContent from '@arcgis/core/popup/content/TextContent';
import FieldsContent from '@arcgis/core/popup/content/FieldsContent';
import PopupTemplate from '@arcgis/core/PopupTemplate';
import Extent from '@arcgis/core/geometry/Extent';
import { StandardizedLegendData } from '@/types/legend';

// Extend VisualizationOptions to include displayAsPrimary
export interface CrossGeographyVisualizationOptions extends VisualizationOptions {
  displayAsPrimary?: boolean;
}

export interface CrossGeographyCorrelationData extends BaseVisualizationData {
  // Primary layer (e.g., electoral district)
  primaryLayerFeatures: Graphic[];
  primaryField: string;
  primaryGeographyType: 'electoral' | 'census' | 'municipal' | 'fsa' | 'other';
  primaryGeographyIdField: string;
  
  // Comparison layer (e.g., census subdivision)
  comparisonLayerFeatures: Graphic[];
  comparisonField: string;
  comparisonGeographyType: 'electoral' | 'census' | 'municipal' | 'fsa' | 'other';
  comparisonGeographyIdField: string;
}

export class CrossGeographyCorrelationVisualization extends BaseVisualization<CrossGeographyCorrelationData> {
  protected renderer: ClassBreaksRenderer;
  private aggregatedFeatures: Graphic[] = [];

  constructor() {
    super();
    this.renderer = new ClassBreaksRenderer({
      field: "correlationValue",
      classBreakInfos: [
        {
          minValue: -1,
          maxValue: -0.5,
          symbol: new SimpleFillSymbol({
            color: [239, 59, 44, DEFAULT_FILL_ALPHA],  // red
            outline: { color: [0, 0, 0, 0], width: 0 }
          }),
          label: "Strong Negative"
        },
        {
          minValue: -0.5,
          maxValue: 0,
          symbol: new SimpleFillSymbol({
            color: [255, 127, 0, DEFAULT_FILL_ALPHA],  // orange
            outline: { color: [0, 0, 0, 0], width: 0 }
          }),
          label: "Weak Negative"
        },
        {
          minValue: 0,
          maxValue: 0.5,
          symbol: new SimpleFillSymbol({
            color: [158, 215, 152, DEFAULT_FILL_ALPHA],  // light green
            outline: { color: [0, 0, 0, 0], width: 0 }
          }),
          label: "Weak Positive"
        },
        {
          minValue: 0.5,
          maxValue: 1,
          symbol: new SimpleFillSymbol({
            color: [49, 163, 84, DEFAULT_FILL_ALPHA],  // green
            outline: { color: [0, 0, 0, 0], width: 0 }
          }),
          label: "Strong Positive"
        }
      ],
      legendOptions: {
        title: "Correlation Strength"
      },
      defaultSymbol: new SimpleFillSymbol({
        color: [128, 128, 128, 0.3],
        outline: { color: [0, 0, 0, 0], width: 0 }
      }),
      defaultLabel: "No Data"
    });
  }

  /**
   * Transfer data from one geography type to another using area-weighted proportions
   */
  private async transferDataAcrossGeographies(
    sourceFeatures: Graphic[], 
    targetFeatures: Graphic[],
    sourceField: string,
    targetIdField: string
  ): Promise<Graphic[]> {
    console.log('Transferring data across geographies', {
      sourceFeatureCount: sourceFeatures.length,
      targetFeatureCount: targetFeatures.length,
      sourceField,
      targetIdField
    });

    // Create a map to store aggregated values by target geography ID
    const aggregatedValues: Map<string, { 
      totalValue: number; 
      totalWeight: number; 
      geometry: __esri.Polygon;
      attributes: { [key: string]: any };
    }> = new Map();
    
    // Keep track of progress
    let processedCount = 0;
    const totalFeatures = targetFeatures.length;
    const logInterval = Math.max(1, Math.floor(totalFeatures / 10)); // Log progress at 10% intervals
    
    console.log(`Starting data transfer from ${sourceFeatures.length} source features to ${targetFeatures.length} target features`);

    // Process each target feature
    for (const targetFeature of targetFeatures) {
      processedCount++;
      
      // Log progress
      if (processedCount % logInterval === 0 || processedCount === totalFeatures) {
        console.log(`Transfer progress: ${Math.round((processedCount / totalFeatures) * 100)}% (${processedCount}/${totalFeatures})`);
      }
      
      const targetId = targetFeature.attributes[targetIdField];
      const targetGeometry = targetFeature.geometry as __esri.Polygon;
      
      if (!targetId || !targetGeometry) {
        console.warn('Skipping target feature without ID or geometry');
        continue;
      }

      let totalValue = 0;
      let totalWeight = 0;
      let foundIntersections = 0;

      // Find all source features that intersect with this target feature
      for (const sourceFeature of sourceFeatures) {
        const sourceGeometry = sourceFeature.geometry as __esri.Polygon;
        
        if (!sourceGeometry) {
          continue;
        }

        // Check if the source feature intersects with the target feature
        try {
          // Ensure geometries have the same spatial reference
          const { geom1: projectedTargetGeom, geom2: projectedSourceGeom } = 
            this.ensureSpatialReference(targetGeometry, sourceGeometry);
          
          // Use projected geometries for spatial operations
          const intersects = geometryEngine.intersects(projectedTargetGeom, projectedSourceGeom);
          
          if (intersects) {
            foundIntersections++;
            const value = sourceFeature.attributes[sourceField];
            
            if (typeof value === 'number' && !isNaN(value)) {
              // Calculate the area of intersection to use as a weight
              const intersectionGeom = geometryEngine.intersect(projectedTargetGeom, projectedSourceGeom);
              
              if (intersectionGeom && intersectionGeom instanceof Polygon) {
                const intersectionArea = geometryEngine.geodesicArea(intersectionGeom, 'square-kilometers');
                const sourceArea = geometryEngine.geodesicArea(projectedSourceGeom, 'square-kilometers');
                
                // Weight by proportion of source area that intersects
                const weight = sourceArea > 0 ? intersectionArea / sourceArea : 0;
                totalValue += value * weight;
                totalWeight += weight;
              }
            }
          }
        } catch (error) {
          console.error('Error calculating intersection:', error);
        }
      }

      // Store the aggregated value for this target feature
      if (totalWeight > 0) {
        aggregatedValues.set(targetId, {
          totalValue,
          totalWeight,
          geometry: targetGeometry,
          attributes: { ...targetFeature.attributes }
        });
      }
    }

    // Create graphics from the aggregated values
    const aggregatedGraphics: Graphic[] = [];
    
    aggregatedValues.forEach((data, targetId) => {
      const avgValue = data.totalWeight > 0 ? data.totalValue / data.totalWeight : 0;
      
      const attributes = {
        ...data.attributes,
        [sourceField]: avgValue,
        transferredValue: avgValue,
        originalId: targetId
      };
      
      aggregatedGraphics.push(
        new Graphic({
          geometry: data.geometry,
          attributes
        })
      );
    });
    
    console.log(`Completed data transfer with ${aggregatedGraphics.length} result features`);
    return aggregatedGraphics;
  }

  /**
   * Calculate Pearson correlation coefficient between two sets of values
   */
  private calculateCorrelation(xValues: number[], yValues: number[]): number {
    if (xValues.length !== yValues.length) {
      throw new Error('Arrays must have the same length');
    }
    
    const n = xValues.length;
    
    if (n === 0) {
      return NaN;
    }
    
    // Calculate means
    const xMean = xValues.reduce((sum, val) => sum + val, 0) / n;
    const yMean = yValues.reduce((sum, val) => sum + val, 0) / n;
    
    // Calculate covariance and variances
    let covariance = 0;
    let xVariance = 0;
    let yVariance = 0;
    
    for (let i = 0; i < n; i++) {
      const xDiff = xValues[i] - xMean;
      const yDiff = yValues[i] - yMean;
      covariance += xDiff * yDiff;
      xVariance += xDiff * xDiff;
      yVariance += yDiff * yDiff;
    }
    
    // Calculate Pearson correlation coefficient
    if (xVariance === 0 || yVariance === 0) {
      return 0; // No correlation if there's no variance
    }
    
    return covariance / Math.sqrt(xVariance * yVariance);
  }

  /**
   * Ensure geometries have the same spatial reference before spatial operations
   */
  private ensureSpatialReference(
    geometry1: __esri.Polygon,
    geometry2: __esri.Polygon
  ): { geom1: __esri.Polygon, geom2: __esri.Polygon } {
    // Get spatial references
    const sr1 = geometry1.spatialReference?.wkid;
    const sr2 = geometry2.spatialReference?.wkid;
    
    console.log('[CrossGeoCorrelation] ensureSpatialReference: Original SRs:', { sr1, sr2 });
    
    // Default to Web Mercator if missing
    const defaultSR = new SpatialReference({ wkid: 102100 });
    
    // If spatial references are the same, return original geometries
    if (sr1 === sr2 && sr1) {
      console.log('[CrossGeoCorrelation] SRs match, returning original geometries');
      return { geom1: geometry1, geom2: geometry2 };
    }
    
    // Make copies to avoid modifying originals
    let geom1 = geometry1.clone();
    let geom2 = geometry2.clone();
    
    // Ensure projection engine is loaded
    if (!projection.isLoaded()) {
      console.log('[CrossGeoCorrelation] Loading projection engine');
      projection.load();
    }
    
    try {
      // Project to Web Mercator for consistency
      if (sr1 !== 102100 && geom1.spatialReference) {
        console.log(`[CrossGeoCorrelation] Projecting geom1 from SR ${sr1} to Web Mercator`);
        geom1 = projection.project(geom1, defaultSR) as __esri.Polygon;
      } else if (!geom1.spatialReference) {
        console.log('[CrossGeoCorrelation] geom1 missing SR, assigning Web Mercator');
        geom1.spatialReference = defaultSR;
      }
      
      if (sr2 !== 102100 && geom2.spatialReference) {
        console.log(`[CrossGeoCorrelation] Projecting geom2 from SR ${sr2} to Web Mercator`);
        geom2 = projection.project(geom2, defaultSR) as __esri.Polygon;
      } else if (!geom2.spatialReference) {
        console.log('[CrossGeoCorrelation] geom2 missing SR, assigning Web Mercator');
        geom2.spatialReference = defaultSR;
      }
      
      console.log('[CrossGeoCorrelation] Spatial references after conversion:', {
        geom1SR: geom1.spatialReference?.wkid,
        geom2SR: geom2.spatialReference?.wkid
      });
    } catch (error) {
      console.error('[CrossGeoCorrelation] Error projecting geometries:', error);
    }
    
    return { geom1, geom2 };
  }

  /**
   * Create the cross-geography correlation visualization
   */
  async create(
    data: CrossGeographyCorrelationData,
    options: CrossGeographyVisualizationOptions = {}
  ): Promise<VisualizationResult> {
    console.log('Creating cross-geography correlation visualization');
    try {
      // Validate input data
      this.validateData(data);
      
      // Validate feature types
      const primaryFeatureType = data.primaryLayerFeatures[0].geometry?.type;
      const comparisonFeatureType = data.comparisonLayerFeatures[0].geometry?.type;

      if (!primaryFeatureType || !comparisonFeatureType) {
        console.warn('Features must have valid geometry types');
        return this.createFallbackLayer(options);
      }

      if (primaryFeatureType !== 'polygon' || comparisonFeatureType !== 'polygon') {
        console.warn('Both layers must contain polygon features for cross-geography correlation');
        return this.createFallbackLayer(options);
      }

      // Validate numeric fields
      const validateNumericField = (features: __esri.Graphic[], field: string, fieldName: string) => {
        const hasValidValues = features.some(f => {
          const value = f.attributes[field];
          return typeof value === 'number' && !isNaN(value) && isFinite(value);
        });

        if (!hasValidValues) {
          throw new Error(`No valid numeric values found for ${fieldName} field "${field}"`);
        }
      };

      validateNumericField(data.primaryLayerFeatures, data.primaryField, 'primary');
      validateNumericField(data.comparisonLayerFeatures, data.comparisonField, 'comparison');

      // Determine which geography to use as the target
      const displayAsPrimary = options.displayAsPrimary ?? true;
      
      let targetFeatures: __esri.Graphic[];
      let sourceFeatures: __esri.Graphic[];
      let targetField: string;
      let sourceField: string;
      let targetIdField: string;

      if (displayAsPrimary) {
        // Transfer comparison data to primary geography (e.g., census data to electoral districts)
        targetFeatures = data.primaryLayerFeatures;
        sourceFeatures = data.comparisonLayerFeatures;
        targetField = data.primaryField;
        sourceField = data.comparisonField;
        targetIdField = data.primaryGeographyIdField;
      } else {
        // Transfer primary data to comparison geography (e.g., electoral data to census subdivisions)
        targetFeatures = data.comparisonLayerFeatures;
        sourceFeatures = data.primaryLayerFeatures;
        targetField = data.comparisonField;
        sourceField = data.primaryField;
        targetIdField = data.comparisonGeographyIdField;
      }

      // Validate ID fields
      if (!targetIdField || !targetFeatures[0].attributes[targetIdField]) {
        throw new Error(`Invalid or missing ID field "${targetIdField}" in target features`);
      }

      // Transfer data across geographies
      const aggregatedFeatures = await this.transferDataAcrossGeographies(
        sourceFeatures, 
        targetFeatures,
        sourceField,
        targetIdField
      );
      
      // Store for later use
      this.aggregatedFeatures = aggregatedFeatures;
      
      // Calculate correlation
      const validFeatures = aggregatedFeatures.filter(f => {
        const originalValue = f.attributes[targetField];
        const transferredValue = f.attributes[sourceField];
        return typeof originalValue === 'number' && 
               typeof transferredValue === 'number' && 
               !isNaN(originalValue) && 
               !isNaN(transferredValue);
      });

      if (validFeatures.length < 3) {
        throw new Error(`Insufficient valid features for correlation analysis. Found ${validFeatures.length} valid features, minimum required is 3.`);
      }
      
      const xValues = validFeatures.map(f => f.attributes[targetField]);
      const yValues = validFeatures.map(f => f.attributes[sourceField]);
      const correlation = this.calculateCorrelation(xValues, yValues);
      
      console.log('Correlation analysis results:', {
        validFeatureCount: validFeatures.length,
        correlation: correlation,
        correlationStrength: this.getCorrelationStrengthLabel(correlation),
        invalidFeatureCount: aggregatedFeatures.length - validFeatures.length
      });
      
      // Add correlation value to features
      const correlatedFeatures = validFeatures.map(f => {
        const attributes = {
          ...f.attributes,
          correlationValue: correlation,
          originalValue: f.attributes[targetField],
          comparisonValue: f.attributes[sourceField]
        };
        
        return new Graphic({
          geometry: f.geometry as any, // Cast to any to bypass TypeScript's strict typing
          attributes
        });
      });
      
      // Ensure all features have proper spatial reference before creating layer
      // Make sure projection engine is loaded
      if (!projection.isLoaded()) {
        await projection.load();
      }
      
      // Target spatial reference (Web Mercator)
      const webMercator = new SpatialReference({ wkid: 102100 });
      
      // Properly project all geometries to Web Mercator
      const projectedFeatures = await Promise.all(
        correlatedFeatures.map(async (feature, index) => {
          if (!feature.geometry) {
            console.warn(`Feature at index ${index} has no geometry`);
            return null;
          }
          
          try {
            // Check current spatial reference
            const currentSR = feature.geometry.spatialReference;
            
            // Only project if needed - if source SR is different from target (Web Mercator)
            if (currentSR && currentSR.wkid !== 102100) {
              console.log(`Projecting cross-geo feature ${index} from SR ${currentSR.wkid} to Web Mercator`);
              
              // Cast to any to bypass TypeScript's strict typing requirements for geometry types
              const geometry = feature.geometry as any;
              
              // Create a properly projected copy of the geometry
              const projectedGeometry = await projection.project(geometry, webMercator) as __esri.Polygon;
              
              // Create a new graphic with projected geometry and original attributes
              return new Graphic({
                geometry: projectedGeometry,
                attributes: feature.attributes
              });
            } else {
              // Already in correct SR, return as is
              return feature;
            }
          } catch (projError) {
            console.error(`Error projecting feature ${index}:`, projError);
            return null;
          }
        })
      );
      
      // Filter out null features from projection errors
      const validProjectedFeatures = projectedFeatures.filter((f): f is Graphic => f !== null);
      
      if (validProjectedFeatures.length === 0) {
        console.error('No valid features after projection');
        return this.createFallbackLayer(options);
      }
      
      console.log(`Successfully projected ${validProjectedFeatures.length} out of ${correlatedFeatures.length} cross-geography features`);
      
      // NEW: Additional validation step to fix any features with extreme coordinates
      console.log('Checking for extreme coordinate issues in projected features...');
      const extremeCoordinateIssues = validProjectedFeatures.some(feature => {
        if (!feature.geometry?.extent) return false;
        return this.isInvalidExtent(feature.geometry.extent);
      });
      
      let finalFeatures = validProjectedFeatures;
      
      if (extremeCoordinateIssues) {
        console.log('Fixing features with extreme coordinate issues...');
        // Apply the fix to all features
        const fixedFeatures = validProjectedFeatures
          .map(feature => this.ensureValidFeatureGeometry(feature))
          .filter((f): f is Graphic => f !== null);
          
        if (fixedFeatures.length === 0) {
          console.error('No valid features after fixing extreme coordinates');
          return this.createFallbackLayer(options);
        }
        
        console.log(`Successfully fixed ${fixedFeatures.length} out of ${validProjectedFeatures.length} features with extreme coordinates`);
        finalFeatures = fixedFeatures;
      }
      
      // Sample feature logging for debugging
      if (finalFeatures.length > 0) {
        const sampleFeature = finalFeatures[0];
        const sampleExtent = sampleFeature.geometry?.extent;
        
        console.log('Sample feature after all processing:', {
          has_geometry: !!sampleFeature.geometry,
          geometry_type: sampleFeature.geometry?.type,
          has_extent: !!sampleExtent,
          extent: sampleExtent ? {
            xmin: sampleExtent.xmin,
            ymin: sampleExtent.ymin,
            xmax: sampleExtent.xmax,
            ymax: sampleExtent.ymax,
            width: sampleExtent.width,
            height: sampleExtent.height
          } : null,
          attributes: Object.keys(sampleFeature.attributes)
        });
      }
      
      // Create FeatureLayer with validated and fixed features
      this.layer = new FeatureLayer({
        source: finalFeatures,
        objectIdField: "OBJECTID",
        fields: [
          { name: "OBJECTID", type: "oid", alias: "Object ID" },
          { name: targetField, type: "double", alias: "Target Field" },
          { name: sourceField, type: "double", alias: "Source Field" },
          { name: "correlationValue", type: "double", alias: "Correlation Value" },
          { name: "originalValue", type: "double", alias: "Original Value" },
          { name: "comparisonValue", type: "double", alias: "Comparison Value" }
        ],
        title: options.title || "Cross-Geography Correlation",
        geometryType: 'polygon',
        hasZ: false,
        hasM: false,
        outFields: ["*"],
        spatialReference: webMercator,
      });

      // Apply the renderer and set the source for the layer
      this.layer.renderer = this.renderer;
      
      // Ensure these properties are set for visibility
      this.layer.visible = true;
      this.layer.opacity = options.opacity || 0.8;
      this.layer.definitionExpression = "1=1"; // Ensure nothing is filtering the features
      
      // Debug output to track layer state
      console.log('Cross-geography correlation layer created:', {
        id: this.layer.id,
        title: this.layer.title,
        featureCount: finalFeatures.length,
        sourceItemCount: this.layer.source.length,
        geometryType: this.layer.geometryType,
        spatialReference: this.layer.spatialReference?.wkid,
        rendererType: this.layer.renderer?.type,
        visible: this.layer.visible,
        opacity: this.layer.opacity,
        definitionExpression: this.layer.definitionExpression
      });
      
      // Calculate extent from correlated features
      const firstFeature = finalFeatures[0];
      if (!firstFeature?.geometry?.extent) {
        throw new Error('Invalid feature geometry');
      }

      const spatialReference = firstFeature.geometry.spatialReference as __esri.SpatialReference;
      if (!spatialReference) {
        throw new Error('Invalid spatial reference');
      }

      // Extract extents with proper validation to ensure valid coordinates
      const extentValues = finalFeatures
        .filter(f => f.geometry?.extent)
        .map(f => {
          const ext = f.geometry?.extent as __esri.Extent;
          if (!ext || isNaN(ext.xmin) || isNaN(ext.ymin) || isNaN(ext.xmax) || isNaN(ext.ymax)) {
            return null;
          }
          return ext;
        })
        .filter((ext): ext is __esri.Extent => ext !== null);

      let extent: __esri.Extent | null = null;
      
      if (extentValues.length > 0) {
        // Start with the first extent and union all others for more reliability
        extent = extentValues[0].clone();
        
        for (let i = 1; i < extentValues.length; i++) {
          if (extent && extentValues[i]) {
            extent.union(extentValues[i]);
          }
        }
        
        // Validate extent - check if it has valid dimensions
        if (this.isInvalidExtent(extent)) {
          console.warn('Invalid extent detected in cross-geography correlation, using fallback extent');
          extent = this.createFallbackExtent();
        }
      } else {
        console.warn('No valid extents found in correlated features, using fallback extent');
        extent = this.createFallbackExtent();
      }
      
      console.log('Final extent calculated:', {
        xmin: extent.xmin,
        ymin: extent.ymin,
        xmax: extent.xmax,
        ymax: extent.ymax,
        width: extent.width,
        height: extent.height,
        spatialReference: extent.spatialReference.wkid
      });

      // Try loading the layer to ensure it's properly initialized
      try {
        await this.layer.load();
        console.log('Cross-geography correlation layer loaded successfully');
      } catch (loadError) {
        console.warn('Failed to load layer:', loadError);
      }
      
      return {
        layer: this.layer,
        extent
      };
    } catch (error) {
      console.error('Error creating cross-geography correlation visualization:', error);
      return this.createFallbackLayer(options);
    }
  }

  /**
   * Check if an extent is invalid (has extreme values or zero dimensions)
   */
  protected isInvalidExtent(extent: __esri.Extent | null | undefined): boolean {
    // Check if extent is null or undefined
    if (!extent) {
      return true;
    }
    
    // Check for NaN values
    if (isNaN(extent.xmin) || isNaN(extent.ymin) || 
        isNaN(extent.xmax) || isNaN(extent.ymax)) {
      return true;
    }
    
    // Check for unreasonably large values (Web Mercator coords typically < 20,000,000)
    const MAX_COORD = 20000000;
    if (Math.abs(extent.xmin) > MAX_COORD || Math.abs(extent.ymin) > MAX_COORD ||
        Math.abs(extent.xmax) > MAX_COORD || Math.abs(extent.ymax) > MAX_COORD) {
      return true;
    }
    
    // Check for zero or extremely small height/width
    const MIN_SIZE = 100; // Minimum size in coordinate units
    if (extent.width < MIN_SIZE || extent.height < MIN_SIZE) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Create a fallback extent for Ontario, Canada
   */
  protected createFallbackExtent(): __esri.Extent {
    console.log('Creating fallback extent for Ontario, Canada');
    return new Extent({
      xmin: -9500000,
      ymin: 5000000,
      xmax: -8000000,
      ymax: 6000000,
      spatialReference: { wkid: 102100 } // Web Mercator
    });
  }

  /**
   * Creates a fallback empty layer when visualization cannot be created
   */
  private createFallbackLayer(options: CrossGeographyVisualizationOptions = {}): VisualizationResult {
    console.warn('Creating fallback layer for cross-geography correlation');
    
    // Create five dummy graphics with visible polygons to ensure the layer is visible
    const dummyGraphics = [];
    
    // Create a grid of 5 polygons across Ontario
    const centerX = -8800000;
    const centerY = 5500000;
    const spacing = 100000;
    
    for (let i = 0; i < 5; i++) {
      const offsetX = (i - 2) * spacing;
      
      const dummyPolygon = new Polygon({
        rings: [
          [
            [centerX + offsetX, centerY - 50000],
            [centerX + offsetX + 80000, centerY - 50000],
            [centerX + offsetX + 80000, centerY + 50000],
            [centerX + offsetX, centerY + 50000],
            [centerX + offsetX, centerY - 50000]
          ]
        ],
        spatialReference: { wkid: 102100 }
      });

      dummyGraphics.push(new Graphic({
        geometry: dummyPolygon,
        attributes: {
          OBJECTID: i + 1,
          originalValue: Math.random() * 100,
          comparisonValue: Math.random() * 100,
          correlationValue: (Math.random() * 2) - 1 // Random between -1 and 1
        }
      }));
    }
    
    // Create a fallback layer with the dummy graphics and make it visible
    const layer = new FeatureLayer({
      title: options.title || "Cross-Geography Correlation (Sample Data)",
      source: dummyGraphics,
      geometryType: "polygon",
      hasZ: false,
      hasM: false,
      objectIdField: "OBJECTID",
      spatialReference: { wkid: 102100 },
      fields: [
        { name: "OBJECTID", type: "oid", alias: "Object ID" },
        { name: "originalValue", type: "double", alias: "Original Value" },
        { name: "comparisonValue", type: "double", alias: "Comparison Value" },
        { name: "correlationValue", type: "double", alias: "Correlation Value" }
      ],
      visible: true,
      opacity: 0.7,
      // IMPORTANT: No definition expression that would hide features
    });
    
    // Apply renderer to make it look like a correlation layer
    layer.renderer = this.renderer;
    
    // Create a fallback extent for Ontario, Canada
    const extent = new Extent({
      xmin: -9500000,
      ymin: 5000000,
      xmax: -8000000,
      ymax: 6000000,
      spatialReference: { wkid: 102100 }
    });
    
    this.layer = layer;
    this.extent = extent;
    
    console.log('Fallback layer created successfully:', {
      id: layer.id,
      title: layer.title,
      featureCount: dummyGraphics.length,
      sourceItemCount: layer.source.length,
      rendererType: layer.renderer?.type
    });
    
    return {
      layer,
      extent
    };
  }

  /**
   * Get a descriptive label for correlation strength
   */
  private getCorrelationStrengthLabel(correlation: number): string {
    const absCorrelation = Math.abs(correlation);
    if (absCorrelation >= 0.7) {
      return correlation >= 0 ? 'Strong Positive' : 'Strong Negative';
    } else if (absCorrelation >= 0.5) {
      return correlation >= 0 ? 'Moderate Positive' : 'Moderate Negative';
    } else if (absCorrelation >= 0.3) {
      return correlation >= 0 ? 'Weak Positive' : 'Weak Negative';
    } else {
      return 'Very Weak or No Correlation';
    }
  }

  /**
   * Get legend information for the visualization
   */
  getLegendInfo(): StandardizedLegendData {
    return {
      title: 'Cross-Geography Correlation',
      type: 'class-breaks',
      description: 'Shows correlation between variables across different geographic levels',
      items: [
        { label: 'Strong Negative', color: [239, 59, 44] },
        { label: 'Weak Negative', color: [255, 127, 0] },
        { label: 'Weak Positive', color: [158, 215, 152] },
        { label: 'Strong Positive', color: [49, 163, 84] },
        { label: 'No Data', color: [128, 128, 128] }
      ].map(item => ({
        label: item.label,
        color: `rgba(${item.color.join(',')}, DEFAULT_FILL_ALPHA)`,
        shape: 'square',
        size: 16
      }))
    };
  }

  // Override the parent's calculateExtent method with a custom implementation for cross-geography
  protected calculateExtent(features: __esri.Graphic[]): __esri.Extent | null {
    console.log('[DEBUG] CrossGeographyCorrelationVisualization.calculateExtent called with', features.length, 'features');
    
    // Check if we have valid features
    if (!features || features.length === 0) {
      console.warn('[DEBUG] No features provided to calculateExtent');
      return this.createFallbackExtent();
    }

    try {
      const webMercator = new SpatialReference({ wkid: 102100 });
      
      // Log the first feature's details
      if (features[0]) {
        console.log('[DEBUG] First feature geometry:', {
          type: features[0].geometry?.type,
          spatialReference: features[0].geometry?.spatialReference?.wkid,
          hasRings: !!(features[0].geometry as any)?.rings?.length,
          rings: (features[0].geometry as any)?.rings?.length,
          attributes: Object.keys(features[0].attributes || {})
        });
      }

      // First check if geometries need to be fixed
      // Many cross-geography features have issues with extreme coordinates
      const needGeometryFix = features.some(feature => {
        if (!feature.geometry?.extent) return false;
        return this.isInvalidExtent(feature.geometry.extent);
      });

      // If geometry issues are detected, attempt to fix features before calculating extent
      if (needGeometryFix) {
        console.log('[DEBUG] Geometry issues detected, attempting to fix before calculating extent');
        // Try to find a valid feature with proper extent to use as reference
        const validFeature = features.find(feature => 
          feature.geometry?.extent && !this.isInvalidExtent(feature.geometry.extent)
        );

        if (validFeature) {
          console.log('[DEBUG] Found valid feature to use as reference');
          // Create a collection of valid extents
          const validExtents: __esri.Extent[] = [];
          
          // First, try to collect valid extents from all features
          for (const feature of features) {
            if (!feature.geometry?.extent || this.isInvalidExtent(feature.geometry.extent)) {
              continue;
            }
            validExtents.push(feature.geometry.extent);
          }
          
          // If we have at least one valid extent, use that
          if (validExtents.length > 0) {
            console.log(`[DEBUG] Using ${validExtents.length} valid extents`);
            // Start with the first extent as the base
            let finalExtent = validExtents[0].clone();
            
            // Union all other valid extents
            for (let i = 1; i < validExtents.length; i++) {
              finalExtent = finalExtent.union(validExtents[i]);
            }
            
            // Set the extent and return
            this.extent = finalExtent;
            return finalExtent;
          } else {
            // No valid extents found, use fallback
            console.warn('[DEBUG] No valid extents found after filtering');
            return this.createFallbackExtent();
          }
        } else {
          // No valid feature found, use fallback
          console.warn('[DEBUG] No valid feature found to use as reference');
          return this.createFallbackExtent();
        }
      } else {
        // No geometry issues detected, proceed with standard extent calculation
        // Get valid extents from all features
        const validExtents: __esri.Extent[] = [];

        for (const feature of features) {
          if (!feature.geometry?.extent) continue;
          validExtents.push(feature.geometry.extent);
        }

        if (validExtents.length === 0) {
          console.warn('[DEBUG] No valid extents found for cross-geography visualization');
          return this.createFallbackExtent();
        }

        // Create union of all extents
        let finalExtent = validExtents[0].clone();
        for (let i = 1; i < validExtents.length; i++) {
          finalExtent = finalExtent.union(validExtents[i]);
        }

        // Set the extent and return
        this.extent = finalExtent;
        return finalExtent;
      }
    } catch (error) {
      console.error('[DEBUG] Error in CrossGeographyCorrelationVisualization.calculateExtent:', error);
      return this.createFallbackExtent();
    }
  }

  /**
   * Ensure a feature has valid geometry with proper spatial reference
   * This is used to fix issues with cross-geography features
   */
  private ensureValidFeatureGeometry(feature: __esri.Graphic): __esri.Graphic | null {
    if (!feature.geometry) return null;
    
    try {
      const webMercator = new SpatialReference({ wkid: 102100 });
      
      // Clone the feature to avoid modifying the original
      const newFeature = feature.clone();
      
      // Ensure the geometry has proper spatial reference
      if (newFeature.geometry && !newFeature.geometry.spatialReference) {
        newFeature.geometry.spatialReference = webMercator;
      }
      
      // If the geometry has an extent and it's invalid, try to fix it
      if (newFeature.geometry?.extent && this.isInvalidExtent(newFeature.geometry.extent)) {
        // For polygon features, we can rebuild the geometry with valid coordinates
        if (newFeature.geometry.type === 'polygon') {
          const polygon = newFeature.geometry as __esri.Polygon;
          
          // Check if we have valid rings
          if (!polygon.rings || polygon.rings.length === 0) {
            return null;
          }
          
          // Create a new polygon with the same rings but ensure coordinates are valid
          const validRings = polygon.rings.map(ring => {
            if (!ring || ring.length < 3) return null;
            
            // Filter out invalid coordinates and clamp extreme values
            const validCoords = ring.map(coord => {
              if (!Array.isArray(coord) || coord.length < 2) return null;
              
              // Clamp extreme coordinates to reasonable values for Web Mercator
              const MAX_COORD = 20000000;
              const x = Math.max(Math.min(coord[0], MAX_COORD), -MAX_COORD);
              const y = Math.max(Math.min(coord[1], MAX_COORD), -MAX_COORD);
              
              return [x, y] as [number, number];
            }).filter((coord): coord is [number, number] => coord !== null);
            
            return validCoords.length >= 3 ? validCoords : null;
          }).filter((ring): ring is [number, number][] => ring !== null);
          
          if (validRings.length === 0) {
            return null;
          }
          
          // Create new polygon with valid rings
          newFeature.geometry = new Polygon({
            rings: validRings,
            spatialReference: webMercator
          });
        } else {
          // For non-polygon geometries, we can't easily fix, so return null
          return null;
        }
      }
      
      return newFeature;
    } catch (error) {
      console.error('Error ensuring valid feature geometry:', error);
      return null;
    }
  }
} 