import { DEFAULT_FILL_ALPHA } from "./constants";
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import UniqueValueRenderer from '@arcgis/core/renderers/UniqueValueRenderer';
import SimpleFillSymbol from '@arcgis/core/symbols/SimpleFillSymbol';
import Extent from '@arcgis/core/geometry/Extent';
import { BaseVisualization, BaseVisualizationData, VisualizationOptions, VisualizationResult } from './base-visualization';
import Color from '@arcgis/core/Color';
import Graphic from '@arcgis/core/Graphic';
import PopupTemplate from '@arcgis/core/PopupTemplate';
import { createPopupTemplateFromConfig } from '@/utils/popup-utils';
import { PopupConfiguration } from '@/types/popup-config';
import type Geometry from '@arcgis/core/geometry/Geometry';
import Point from '@arcgis/core/geometry/Point';
import Polygon from '@arcgis/core/geometry/Polygon';
import Polyline from '@arcgis/core/geometry/Polyline';
import Multipoint from '@arcgis/core/geometry/Multipoint';
import Mesh from '@arcgis/core/geometry/Mesh';
import SimpleRenderer from '@arcgis/core/renderers/SimpleRenderer';
import { FieldMappingHelper } from './field-mapping-helper';

export interface MultivariateData extends BaseVisualizationData {
  features: __esri.Graphic[];
  correlationFields: string[];
  title: string;
  layerId: string;
  layerName: string;
}

interface NormalizedFeatureData {
  graphic: __esri.Graphic;
  normalizedValues: { [key: string]: number };
  originalValues: { [key: string]: number };
}

interface ClassifiedFeatureData extends NormalizedFeatureData {
  profileType: string;
}

interface MultivariateVisualizationOptions extends VisualizationOptions {
  numBins?: number;
  popupConfig?: PopupConfiguration;
}

export class MultivariateVisualization extends BaseVisualization<MultivariateData> {
  protected renderer: UniqueValueRenderer | null = null;
  protected title: string;
  protected layer: FeatureLayer | null = null;
  protected extent: Extent | null = null;
  protected data: MultivariateData | null = null;

  private profileColors: { [key: string]: Color } = {};
  private fieldsUsed: string[] = [];

  constructor() {
    super();
    this.title = 'Multivariate Pattern Analysis';
  }

  private calculateZScores(values: (number | null | undefined)[]): (number | null)[] {
    const validValues = values.filter((v): v is number => typeof v === 'number' && isFinite(v));

    if (validValues.length === 0) {
      return values.map(() => null);
    }

    const mean = validValues.reduce((sum, v) => sum + v, 0) / validValues.length;
    const stdDev = Math.sqrt(
      validValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / validValues.length
    );

    const safeStdDev = stdDev === 0 ? 1 : stdDev;

    return values.map(v => {
      if (typeof v === 'number' && isFinite(v)) {
        return Math.max(-3, Math.min(3, (v - mean) / safeStdDev));
      }
      return null;
    });
  }

  private classifyValue(zScore: number | null, numBins: number = 3): string {
    if (zScore === null) return 'N/A';

    if (numBins === 3) {
      if (zScore < -0.5) return 'Low';
      if (zScore > 0.5) return 'High';
      return 'Medium';
    } else {
      if (zScore < 0) return 'Low';
      return 'High';
    }
  }

  private assignProfileType(
    normalizedValues: { [key: string]: number | null },
    fields: string[],
    numBins: number = 3
  ): string {
    const classifications = fields.map((field, index) => ({
      field,
      classification: this.classifyValue(normalizedValues[field] ?? null, numBins),
      index
    }));
    
    // Create meaningful categories based on which variable(s) dominate
    const highFields = classifications.filter(c => c.classification === 'High');
    const mediumFields = classifications.filter(c => c.classification === 'Medium');
    const lowFields = classifications.filter(c => c.classification === 'Low');
    
    // Get short, meaningful names from field codes using the existing helper
    const getVariableName = (field: string): string => {
      const displayName = this.getFieldDisplayName(field);
      
      // Extract the key part of the name for profile classification
      // For "Nike Athletic Shoes (%)" -> "Nike"
      // For "Population Density" -> "Pop Density"
      // For "Median Income" -> "Income"
      const shortName = displayName
        .replace(/\s*\([^)]*\)/g, '') // Remove parentheses content like "(%)"
        .replace(/Athletic\s+Shoes?/gi, '') // Remove "Athletic Shoes"
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
      
      // If it's still long, try to abbreviate common words
      if (shortName.length > 12) {
        return shortName
          .replace(/Population/gi, 'Pop')
          .replace(/Density/gi, 'Dens')
          .replace(/Median/gi, 'Med')
          .replace(/Average/gi, 'Avg')
          .replace(/Percentage/gi, '%')
          .replace(/\s+/g, ' ')
          .trim();
      }
      
      return shortName || field; // Fallback to original field name
    };
    
    // Create contextually meaningful categories
    if (highFields.length === 1) {
      const dominantVar = getVariableName(highFields[0].field);
      return `High ${dominantVar}`;
    } else if (highFields.length === 2) {
      const vars = highFields.map(f => getVariableName(f.field)).sort();
      return `High ${vars.join(' & ')}`;
    } else if (highFields.length >= 3) {
      return 'Multi-Variable High';
    } else if (mediumFields.length >= fields.length - 1) {
      // Most variables are medium
      return 'Balanced Profile';
    } else if (lowFields.length >= fields.length - 1) {
      // Most variables are low, but check if there's a standout medium/high variable
      if (mediumFields.length === 1) {
        const standoutVar = getVariableName(mediumFields[0].field);
        return `${standoutVar} Focus`;
      } else if (highFields.length === 1) {
        const standoutVar = getVariableName(highFields[0].field);
        return `${standoutVar} Focus`;
      } else {
        return 'Low Activity';
      }
    } else {
      // Mixed scenarios - identify the dominant pattern
      if (mediumFields.length === 1 && highFields.length === 0) {
        const mediumVar = getVariableName(mediumFields[0].field);
        return `Moderate ${mediumVar}`;
      } else if (highFields.length > 0 && mediumFields.length > 0) {
        // Mixed high and medium
        const highVars = highFields.map(f => getVariableName(f.field));
        if (highVars.length === 1) {
          return `${highVars[0]} Focus`;
        } else {
          return 'Mixed High Activity';
        }
      } else {
        return 'Mixed Profile';
      }
    }
  }

  private generateDistinctColors(count: number): Color[] {
    const colors: Color[] = [];
    for (let i = 0; i < count; i++) {
      const hue = (i * (360 / count)) % 360;
      const rgb = this.hslToRgb(hue / 360, 0.7, 0.5); // Use proper saturation value, not alpha
      colors.push(new Color([rgb[0], rgb[1], rgb[2], DEFAULT_FILL_ALPHA])); // Apply alpha correctly
    }
    return colors;
  }

  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    let r: number, g: number, b: number;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  async create(
    data: MultivariateData,
    options: MultivariateVisualizationOptions = {}
  ): Promise<VisualizationResult> {
    const startTime = performance.now();
    console.log('=== Creating Multivariate Visualization ===');
    console.log('Input data:', {
      featureCount: data.features?.length,
      correlationFields: data.correlationFields,
      title: data.title,
      spatialReference: data.features?.[0]?.geometry?.spatialReference?.wkid,
      sampleFeature: data.features?.[0] ? {
        hasGeometry: !!data.features[0].geometry,
        geometryType: data.features[0].geometry?.type,
        attributeKeys: Object.keys(data.features[0].attributes || {}),
        sampleAttributes: data.features[0].attributes
      } : 'No features'
    });

    this.data = data;
    this.title = options.title || data.title || 'Multivariate Analysis';
    this.fieldsUsed = [...data.correlationFields];
    const numBins = options.numBins || 3;

    if (!data.features?.length) throw new Error('No features provided.');
    if (!Array.isArray(data.correlationFields)) {
      throw new Error('correlationFields must be an array');
    }
    if (!data.correlationFields.length) throw new Error('No correlationFields provided.');
    if (!data.features[0]?.geometry?.spatialReference) throw new Error('Features lack spatial reference.');

    const targetSR = data.features[0].geometry.spatialReference;

    console.log('Normalizing data and validating features...');
    const normalizationStartTime = performance.now();
    const normalizedFeatures: NormalizedFeatureData[] = [];
    let fullExtent: Extent | null = null;
    let skippedCount = 0;

    const valuesByField: { [key: string]: (number | null | undefined)[] } = {};
    data.correlationFields.forEach(field => {
      valuesByField[field] = data.features.map(f => f.attributes?.[field]);
    });

    const zScoresByField: { [key: string]: (number | null)[] } = {};
    data.correlationFields.forEach(field => {
      zScoresByField[field] = this.calculateZScores(valuesByField[field]);
    });

    for (let i = 0; i < data.features.length; i++) {
      const feature = data.features[i];
      let isValid = true;
      const normalizedValues: { [key: string]: number } = {};
      const originalValues: { [key: string]: number } = {};

      for (const field of data.correlationFields) {
        const zScore = zScoresByField[field][i];
        const originalValue = valuesByField[field][i];

        if (zScore === null || originalValue === null || originalValue === undefined) {
          isValid = false;
          break;
        }
        normalizedValues[field] = zScore;
        originalValues[field] = originalValue;
      }

      // Explicitly cast geometry to the expected type
      const geometry = feature.geometry as Geometry | null;

      if (!geometry) {
          isValid = false;
      }

      if (isValid) {
        normalizedFeatures.push({
          graphic: feature,
          normalizedValues,
          originalValues
        });

        if (feature.geometry?.extent) {
          try {
          if (fullExtent) {
            fullExtent = fullExtent.union(feature.geometry.extent);
          } else {
            fullExtent = feature.geometry.extent.clone();
            }
          } catch (extentError) {
            console.warn('[MultivariateViz] Error processing extent for feature:', extentError);
          }
        }
      } else {
        skippedCount++;
      }
    }

    console.log(`Normalization & Validation complete: ${normalizedFeatures.length} valid features, ${skippedCount} skipped. Time: ${(performance.now() - normalizationStartTime).toFixed(2)}ms`);

    if (normalizedFeatures.length === 0) {
      throw new Error('No valid features remain after normalization and validation.');
    }

    if (!fullExtent || !super.isValidExtent(fullExtent)) {
      console.warn("Calculated extent is invalid, attempting fallback.");
      try {
      fullExtent = await super.calculateExtent(normalizedFeatures.map(f => f.graphic));
      } catch (fallbackError) {
        console.warn("Fallback extent calculation failed:", fallbackError);
        fullExtent = null;
      }
      
      if (!fullExtent || !super.isValidExtent(fullExtent)) {
        console.warn("Creating default extent as fallback");
        // Create a default extent for North America
        const { default: Extent } = await import('@arcgis/core/geometry/Extent');
        fullExtent = new Extent({
          xmin: -20000000,
          ymin: 2000000,
          xmax: -5000000,
          ymax: 10000000,
          spatialReference: { wkid: 102100 }
        });
      }
    }
    this.extent = fullExtent.expand(1.1);

    console.log(`Classifying features into ${numBins} bins per field...`);
    const classificationStartTime = performance.now();
    const classifiedFeatures: ClassifiedFeatureData[] = normalizedFeatures.map(nf => ({
      ...nf,
      profileType: this.assignProfileType(nf.normalizedValues, data.correlationFields, numBins)
    }));
    console.log(`Classification complete. Time: ${(performance.now() - classificationStartTime).toFixed(2)}ms`);

    console.log('Creating Unique Value Renderer...');
    const rendererStartTime = performance.now();
    
    let sourceGraphics: Graphic[];
    
    // For 3-variable ternary visualization, create unique symbols for each feature
    if (data.correlationFields.length === 3) {
      console.log('Creating ternary color renderer for 3 variables');
      
      // Discrete ternary color system with 9 distinct regions (matches TernaryPlot.tsx)
      const calculateTernaryColor = (a: number, b: number, c: number, alpha: number = 0.6): string => {
        // Normalize values to ensure they sum to 1
        const sum = a + b + c;
        if (sum === 0) return `rgba(128, 128, 128, ${alpha})`;
        
        const normA = a / sum;
        const normB = b / sum;
        const normC = c / sum;
        
        // Map to one of the 9 triangular regions - each with its own distinct color
        const triangleRegions = [
          { id: 1, a: 0.8, b: 0.1, c: 0.1, color: [255, 69, 0], name: 'region_1' },     // Red-Orange - A pure
          { id: 2, a: 0.1, b: 0.8, c: 0.1, color: [50, 205, 50], name: 'region_2' },    // Lime Green - B pure  
          { id: 3, a: 0.4, b: 0.3, c: 0.3, color: [255, 165, 0], name: 'region_3' },    // Orange - A dominant mixed
          { id: 4, a: 0.1, b: 0.1, c: 0.8, color: [138, 43, 226], name: 'region_4' },   // Blue Violet - C pure
          { id: 5, a: 0.3, b: 0.6, c: 0.1, color: [255, 215, 0], name: 'region_5' },    // Gold - B dominant mixed
          { id: 6, a: 0.6, b: 0.1, c: 0.3, color: [255, 20, 147], name: 'region_6' },   // Deep Pink - A-C mix
          { id: 7, a: 0.2, b: 0.2, c: 0.6, color: [75, 0, 130], name: 'region_7' },     // Indigo - C dominant mixed
          { id: 8, a: 0.3, b: 0.3, c: 0.4, color: [0, 191, 255], name: 'region_8' },    // Deep Sky Blue - C leaning
          { id: 9, a: 0.4, b: 0.4, c: 0.2, color: [154, 205, 50], name: 'region_9' }    // Yellow Green - A-B mix
        ];

        // Find closest region
        let closestRegion = triangleRegions[0];
        let minDistance = Infinity;

        for (const region of triangleRegions) {
          const distance = Math.sqrt(
            Math.pow(normA - region.a, 2) + 
            Math.pow(normB - region.b, 2) + 
            Math.pow(normC - region.c, 2)
          );
          
          if (distance < minDistance) {
            minDistance = distance;
            closestRegion = region;
          }
        }

        const classification = closestRegion.name;
        const [red, green, blue] = closestRegion.color;
        
        return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
      };
      
      // Create color-coded features and collect unique color combinations
      const colorMap = new Map<string, { color: string, count: number, features: any[] }>();
      
      sourceGraphics = classifiedFeatures.map(cf => {
        const values = data.correlationFields.map(field => cf.normalizedValues[field] || 0);
        const ternaryColor = calculateTernaryColor(values[0], values[1], values[2], 0.6);
        
        // Create a color key based on the 9-region classification
        const sum = values[0] + values[1] + values[2];
        const normA = sum > 0 ? values[0] / sum : 0;
        const normB = sum > 0 ? values[1] / sum : 0;
        const normC = sum > 0 ? values[2] / sum : 0;
        
        // Find the closest triangular region (same logic as calculateTernaryColor)
        const triangleRegions = [
          { id: 1, a: 0.8, b: 0.1, c: 0.1, name: 'region_1' },     // Red-Orange - A pure
          { id: 2, a: 0.1, b: 0.8, c: 0.1, name: 'region_2' },    // Lime Green - B pure  
          { id: 3, a: 0.4, b: 0.3, c: 0.3, name: 'region_3' },    // Orange - A dominant mixed
          { id: 4, a: 0.1, b: 0.1, c: 0.8, name: 'region_4' },   // Blue Violet - C pure
          { id: 5, a: 0.3, b: 0.6, c: 0.1, name: 'region_5' },    // Gold - B dominant mixed
          { id: 6, a: 0.6, b: 0.1, c: 0.3, name: 'region_6' },   // Deep Pink - A-C mix
          { id: 7, a: 0.2, b: 0.2, c: 0.6, name: 'region_7' },     // Indigo - C dominant mixed
          { id: 8, a: 0.3, b: 0.3, c: 0.4, name: 'region_8' },    // Deep Sky Blue - C leaning
          { id: 9, a: 0.4, b: 0.4, c: 0.2, name: 'region_9' }    // Yellow Green - A-B mix
        ];

        let closestRegion = triangleRegions[0];
        let minDistance = Infinity;

        for (const region of triangleRegions) {
          const distance = Math.sqrt(
            Math.pow(normA - region.a, 2) + 
            Math.pow(normB - region.b, 2) + 
            Math.pow(normC - region.c, 2)
          );
          
          if (distance < minDistance) {
            minDistance = distance;
            closestRegion = region;
          }
        }

        const colorKey = closestRegion.name;
        
        if (!colorMap.has(colorKey)) {
          colorMap.set(colorKey, { color: ternaryColor, count: 0, features: [] });
        }
        colorMap.get(colorKey)!.count++;
        colorMap.get(colorKey)!.features.push(cf);
        
        return new Graphic({
          geometry: cf.graphic.geometry,
          attributes: {
            ...cf.graphic.attributes,
            ...cf.originalValues,
            profile_type: cf.profileType,
            color_key: colorKey
          }
        });
      });
      
      // Create unique value infos for each color group
      const uniqueValueInfos = Array.from(colorMap.entries()).map(([colorKey, info]) => {
        // Extract RGB values from the color string
        const colorMatch = info.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        const [, r, g, b, a] = colorMatch || ['', '128', '128', '128', '0.6'];
        
        return {
          value: colorKey,
          symbol: new SimpleFillSymbol({
            color: new Color([parseInt(r), parseInt(g), parseInt(b), parseFloat(a || '0.6')]),
            outline: { color: [0, 0, 0, 0], width: 0 }
          }),
          label: `${info.count} features` // Simple label showing count
        };
      });

      this.renderer = new UniqueValueRenderer({
        field: 'color_key',
        uniqueValueInfos: uniqueValueInfos,
        defaultSymbol: new SimpleFillSymbol({
          color: new Color([200, 200, 200, 0.5]),
          outline: { color: [0, 0, 0, 0], width: 0 }
        }),
        defaultLabel: "Other/No Data"
      });
      
    } else {
      // Use profile-based rendering for non-ternary cases
      const uniqueProfileTypes = Array.from(new Set(classifiedFeatures.map(cf => cf.profileType)));
    console.log(`Found ${uniqueProfileTypes.length} unique profile types.`);

    const uniqueColors = this.generateDistinctColors(uniqueProfileTypes.length);
    this.profileColors = {};

    const uniqueValueInfos = uniqueProfileTypes.map((profile, index) => {
      const color = uniqueColors[index % uniqueColors.length];
      this.profileColors[profile] = color;
      return {
        value: profile,
        symbol: new SimpleFillSymbol({
          color: new Color([color.r, color.g, color.b, DEFAULT_FILL_ALPHA]),
          outline: { color: [0, 0, 0, 0], width: 0 }
        }),
        label: profile
      };
    });

    this.renderer = new UniqueValueRenderer({
      field: 'profile_type',
      uniqueValueInfos: uniqueValueInfos,
      defaultSymbol: new SimpleFillSymbol({
        color: new Color([200, 200, 200, 0.5]),
        outline: { color: [0, 0, 0, 0], width: 0 }
      }),
      defaultLabel: "Other/No Data",
      legendOptions: {
        title: `${this.title} Profiles`
      }
    });
      
      sourceGraphics = classifiedFeatures.map(cf => {
      return new Graphic({
          geometry: cf.graphic.geometry,
        attributes: {
          ...cf.graphic.attributes,
          ...cf.originalValues,
            profile_type: cf.profileType
        }
      });
    });
    }
    console.log(`Renderer created. Time: ${(performance.now() - rendererStartTime).toFixed(2)}ms`);

    console.log('Creating Feature Layer...');
    const layerCreationTime = performance.now();

    let oidField: string;
    try {
      oidField = this.findObjectIdField(sourceGraphics[0]?.attributes || {});
    } catch (oidError) {
      console.warn('[MultivariateViz] Could not find OID field, using OBJECTID:', oidError);
      oidField = 'OBJECTID';
    }

    const layerFields = [
      { name: oidField, alias: 'Object ID', type: 'oid' as const },
      { name: 'profile_type', alias: 'Profile Type', type: 'string' as const },
      ...(data.correlationFields.length === 3 ? [{ name: 'color_key', alias: 'Color Key', type: 'string' as const }] : []),
      ...this.fieldsUsed.map(fieldName => ({
        name: fieldName,
        alias: fieldName,
        type: 'double' as const
      }))
    ];

    const uniqueLayerFields = layerFields.filter((field, index, self) =>
        index === self.findIndex((f) => f.name === field.name)
    );

    this.layer = new FeatureLayer({
      title: this.title,
      source: sourceGraphics,
      objectIdField: oidField,
      fields: uniqueLayerFields,
      renderer: this.renderer,
      opacity: options.opacity ?? 0.6,
      spatialReference: targetSR,
    });

    this.applyPopupTemplate(this.layer, options.popupConfig);

    console.log(`Feature Layer created. Time: ${(performance.now() - layerCreationTime).toFixed(2)}ms`);
    console.log('[MultivariateViz] Layer details:', {
      title: this.layer.title,
      sourceCount: sourceGraphics.length,
      oidField,
      fieldsCount: uniqueLayerFields.length,
      rendererType: this.renderer?.type,
      uniqueValueInfosCount: this.renderer?.uniqueValueInfos?.length,
      spatialReference: targetSR?.wkid,
      extent: this.extent ? {
        xmin: this.extent.xmin,
        ymin: this.extent.ymin,
        xmax: this.extent.xmax,
        ymax: this.extent.ymax
      } : 'No extent'
    });

    const endTime = performance.now();
    console.log(`=== Multivariate Visualization Complete. Total Time: ${(endTime - startTime).toFixed(2)}ms ===`);

    // Debug: Check legend info before returning
    const legendInfo = this.getLegendInfo();
    console.log('[MultivariateViz] Legend info being returned:', legendInfo);

    return { 
      layer: this.layer, 
      extent: this.extent,
      renderer: this.renderer,
      legendInfo: legendInfo
    };
  }

  protected applyPopupTemplate(layer: FeatureLayer, popupConfig?: PopupConfiguration): void {
    console.log('[MultivariateVisualization] Applying popup template, popupConfig provided:', !!popupConfig);
    
    if (popupConfig) {
      layer.popupTemplate = createPopupTemplateFromConfig(popupConfig);
      console.log('[MultivariateVisualization] Applied popup from config');
    } else {
      // Use standardized popup with multivariate-specific fields
      this.applyStandardizedPopup(
        layer,
        this.fieldsUsed, // Use the fields from multivariate analysis for bar chart
        ['DESCRIPTION', 'ID', 'profile_type'], // List fields for multivariate
        'multivariate'
      );
      console.log('[MultivariateVisualization] ✅ Applied standardized popup with multivariate fields');
    }
    
    console.log('[MultivariateVisualization] Applied popup template with value bars.');
  }

  private createMultivariatePopupContent(graphic: __esri.Graphic): HTMLElement {
    console.log('[MultivariateViz] Creating custom popup content for graphic:', {
      hasAttributes: !!graphic.attributes,
      profileType: graphic.attributes?.profile_type,
      fieldsUsed: this.fieldsUsed,
      attributeKeys: Object.keys(graphic.attributes || {})
    });

    const div = document.createElement('div');
    div.className = 'multivariate-popup-container';
    div.style.cssText = `
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      color: #333;
      max-width: 300px;
    `;

    // Profile type header
    const profileHeader = document.createElement('div');
    profileHeader.style.cssText = `
      background: #f8f9fa;
      padding: 12px;
      border-radius: 6px;
      margin-bottom: 16px;
      border-left: 4px solid #007ac2;
    `;
    
    const profileTitle = document.createElement('div');
    profileTitle.style.cssText = `
      font-weight: 600;
      color: #007ac2;
      margin-bottom: 4px;
    `;
    profileTitle.textContent = 'Profile Classification';
    
    const profileValue = document.createElement('div');
    profileValue.style.cssText = `
      font-size: 16px;
      font-weight: 500;
      color: #333;
    `;
    profileValue.textContent = graphic.attributes.profile_type || 'Unknown';
    
    profileHeader.appendChild(profileTitle);
    profileHeader.appendChild(profileValue);
    div.appendChild(profileHeader);

    // Variable values with bars
    const variablesHeader = document.createElement('div');
    variablesHeader.style.cssText = `
      font-weight: 600;
      color: #333;
      margin-bottom: 12px;
      font-size: 15px;
    `;
    variablesHeader.textContent = 'Variable Values';
    div.appendChild(variablesHeader);

    // Get all field values and find max for scaling
    const fieldValues = this.fieldsUsed.map(field => ({
      field,
      value: graphic.attributes[field] || 0,
      label: this.getFieldDisplayName(field)
    }));

    const maxValue = Math.max(...fieldValues.map(fv => fv.value), 1); // Prevent division by zero

    // Create value bars for each field
    fieldValues.forEach((fieldData, index) => {
      const fieldContainer = document.createElement('div');
      fieldContainer.style.cssText = `
        margin-bottom: 12px;
        padding: 8px 0;
        ${index < fieldValues.length - 1 ? 'border-bottom: 1px solid #eee;' : ''}
      `;

      // Field label and value
      const fieldHeader = document.createElement('div');
      fieldHeader.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      `;

      const fieldLabel = document.createElement('span');
      fieldLabel.style.cssText = `
        font-weight: 500;
        color: #555;
        font-size: 13px;
      `;
      fieldLabel.textContent = fieldData.label;

      const fieldValue = document.createElement('span');
      fieldValue.style.cssText = `
        font-weight: 600;
        color: #333;
        font-size: 13px;
      `;
      fieldValue.textContent = this.formatFieldValue(fieldData.value, fieldData.field);

      fieldHeader.appendChild(fieldLabel);
      fieldHeader.appendChild(fieldValue);

      // Progress bar
      const barContainer = document.createElement('div');
      barContainer.style.cssText = `
        background: #f0f0f0;
        border-radius: 4px;
        height: 8px;
        overflow: hidden;
        position: relative;
      `;

      const barFill = document.createElement('div');
      const percentage = (fieldData.value / maxValue) * 100;
      const barColor = this.getBarColor(index, fieldValues.length);
      barFill.style.cssText = `
        background: ${barColor};
        height: 100%;
        width: ${Math.max(percentage, 2)}%; /* Minimum 2% for visibility */
        border-radius: 4px;
        transition: width 0.3s ease;
      `;

      barContainer.appendChild(barFill);
      
      fieldContainer.appendChild(fieldHeader);
      fieldContainer.appendChild(barContainer);
      div.appendChild(fieldContainer);
    });

    return div;
  }

  private getFieldDisplayName(fieldName: string): string {
    // Import field mapping helper dynamically to avoid circular dependencies
    try {
      // Try to get friendly name from field mapping helper
      const { FieldMappingHelper } = require('@/utils/visualizations/field-mapping-helper');
      return FieldMappingHelper.getFriendlyFieldName(fieldName) || this.prettifyFieldName(fieldName);
    } catch (error) {
      return this.prettifyFieldName(fieldName);
    }
  }

  private prettifyFieldName(fieldName: string): string {
    // Convert field codes to readable names
    const fieldMappings: { [key: string]: string } = {
      'MP30034A_B_P': 'Nike Athletic Shoes (%)',
      'MP30035A_B_P': 'Puma Athletic Shoes (%)',
      'MP30033A_B_P': 'New Balance Athletic Shoes (%)',
      'MP30029A_B_P': 'Adidas Athletic Shoes (%)',
      'MP30032A_B_P': 'Jordan Athletic Shoes (%)',
      'MP30031A_B_P': 'Converse Athletic Shoes (%)',
      'MP30036A_B_P': 'Reebok Athletic Shoes (%)',
      'MP30030A_B_P': 'ASICS Athletic Shoes (%)',
      'MP30037A_B_P': 'Skechers Athletic Shoes (%)',
      'MP30034A_B': 'Nike Athletic Shoes',
      'MP30035A_B': 'Puma Athletic Shoes',
      'MP30033A_B': 'New Balance Athletic Shoes',
      'MP30029A_B': 'Adidas Athletic Shoes',
      'MP30032A_B': 'Jordan Athletic Shoes',
      'MP30031A_B': 'Converse Athletic Shoes',
      'MP30036A_B': 'Reebok Athletic Shoes',
      'MP30030A_B': 'ASICS Athletic Shoes',
      'MP30037A_B': 'Skechers Athletic Shoes'
    };

    if (fieldMappings[fieldName]) {
      return fieldMappings[fieldName];
    }

    // Fallback: convert snake_case or camelCase to readable format
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  private formatFieldValue(value: number, fieldName: string): string {
    if (typeof value !== 'number') return 'N/A';
    
    // Enhanced field type detection using same logic as main API
    const lowerFieldName = fieldName.toLowerCase();
    
    // Check for index/score fields first
    const isIndex = lowerFieldName.includes('index') ||
                   lowerFieldName.includes('score') ||
                   lowerFieldName.includes('level') ||
                   lowerFieldName.includes('rank') ||
                   lowerFieldName.includes('rating') ||
                   lowerFieldName === 'thematic_value';
    
    // Check for percentage fields
    const isPercentage = !isIndex && (
                         lowerFieldName.includes('percent') ||
                         lowerFieldName.includes('rate') ||
                         lowerFieldName.includes('ratio') ||
                         lowerFieldName.includes('proportion') ||
                         lowerFieldName.includes('share') ||
                         lowerFieldName.includes('growth') ||
                         lowerFieldName.includes('fan') ||
                         lowerFieldName.includes('%') ||
                         lowerFieldName.includes('_p') ||
                         lowerFieldName.includes('pct'));
    
    // Check for currency fields
    const isCurrency = !isIndex && !isPercentage && (
                       lowerFieldName.includes('income') ||
                       lowerFieldName.includes('spending') ||
                       lowerFieldName.includes('revenue') ||
                       lowerFieldName.includes('cost') ||
                       lowerFieldName.includes('sales') ||
                       lowerFieldName.includes('price') ||
                       lowerFieldName.includes('value') ||
                       lowerFieldName.includes('budget') ||
                       lowerFieldName.includes('$'));
    
    // Format based on field type
    if (isIndex) {
      // Format index values without units
      if (Math.abs(value) < 10) {
        return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } else {
        return value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      }
    } else if (isPercentage) {
      // Format percentage values
      if (value > 0 && value < 1) {
        // Convert decimal to percentage
        return `${(value * 100).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
      } else {
        // Already in percentage form
        return `${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
      }
    } else if (isCurrency) {
      // Format currency values
      if (value >= 1000000) {
        return `$${(value / 1000000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
      } else if (value >= 1000) {
        return `$${(value / 1000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}K`;
      } else {
        return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
      }
    } else {
      // Default numeric formatting
      return value.toLocaleString(undefined, { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 2 
      });
    }
  }

  private getBarColor(index: number, total: number): string {
    // Generate distinct colors for the bars
    const colors = [
      '#007ac2', // Blue
      '#28a745', // Green  
      '#ffc107', // Yellow
      '#dc3545', // Red
      '#6f42c1', // Purple
      '#fd7e14', // Orange
      '#20c997', // Teal
      '#e83e8c', // Pink
      '#6c757d'  // Gray
    ];
    
    return colors[index % colors.length];
  }

  getRenderer(): UniqueValueRenderer | null {
    return this.renderer;
  }

  getLegendInfo(): any {
    console.log('[MultivariateViz] getLegendInfo called');
    
    if (!this.renderer || !this.renderer.uniqueValueInfos) {
      console.error('[MultivariateViz] Renderer or uniqueValueInfos is null:', {
        hasRenderer: !!this.renderer,
        hasUniqueValueInfos: !!this.renderer?.uniqueValueInfos,
        uniqueValueInfosLength: this.renderer?.uniqueValueInfos?.length
      });
      throw new Error('Renderer or uniqueValueInfos is null or undefined');
    }

    console.log('[MultivariateViz] Processing uniqueValueInfos:', {
      count: this.renderer.uniqueValueInfos.length,
      fieldsUsed: this.fieldsUsed,
      hasData: !!this.data,
      featureCount: this.data?.features?.length
    });

    // If we have exactly 3 variables, create a ternary plot instead of standard legend
    if (this.fieldsUsed.length === 3 && this.data?.features) {
      console.log('[MultivariateViz] Creating ternary plot legend for 3 variables');
      
      const ternaryData = this.data.features.map((feature, index) => {
        const values: [number, number, number] = [
          feature.attributes[this.fieldsUsed[0]] || 0,
          feature.attributes[this.fieldsUsed[1]] || 0,
          feature.attributes[this.fieldsUsed[2]] || 0
        ];
        
        // Use ternary color mapping based on the three variable values
        // Discrete ternary color system with 9 distinct regions (matches TernaryPlot.tsx)
        const calculateTernaryColor = (a: number, b: number, c: number, alpha: number = 0.6): string => {
          const sum = a + b + c;
          if (sum === 0) return `rgba(128, 128, 128, ${alpha})`;
          
          const normA = a / sum;
          const normB = b / sum;
          const normC = c / sum;
          
                  // Use same simplified classification as plot
        const threshold = 0.4;
        let classification = 'balanced';
        let [red, green, blue] = [160, 160, 160];
        
        if (normA > threshold && normA > normB && normA > normC) {
          classification = 'A_dominant';
          [red, green, blue] = [64, 224, 208]; // Turquoise
        } else if (normB > threshold && normB > normA && normB > normC) {
          classification = 'B_dominant';
          [red, green, blue] = [255, 215, 0]; // Gold
        } else if (normC > threshold && normC > normA && normC > normB) {
          classification = 'C_dominant';
          [red, green, blue] = [138, 43, 226]; // Blue Violet
        } else {
          classification = 'balanced';
          [red, green, blue] = [160, 160, 160]; // Grey
        }
          return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
        };
        
        const color = calculateTernaryColor(values[0], values[1], values[2], 0.6);
        
        // Debug first few points
        if (index < 3) {
          console.log('[MultivariateViz] Point', index, 'ternary color mapping:', {
            values: values,
            finalColor: color,
            fieldsUsed: this.fieldsUsed
          });
        }

        // Get feature ID for linking to map
        let featureId: string | undefined;
        try {
          const oidField = this.findObjectIdField(feature.attributes);
          featureId = String(feature.attributes[oidField]);
        } catch (error) {
          console.warn('[MultivariateViz] Could not find feature ID:', error);
          featureId = undefined;
        }

        return {
          values,
          label: `${values[0].toFixed(1)}|${values[1].toFixed(1)}|${values[2].toFixed(1)}`, // Dynamic label based on values
          color,
          featureId
        };
      });

      // Get friendly field names for labels
      const labels: [string, string, string] = [
        FieldMappingHelper.getFriendlyFieldName(this.fieldsUsed[0] || ''),
        FieldMappingHelper.getFriendlyFieldName(this.fieldsUsed[1] || ''),
        FieldMappingHelper.getFriendlyFieldName(this.fieldsUsed[2] || '')
      ];
      
      console.log('[MultivariateViz] Generated labels:', {
        rawFields: this.fieldsUsed,
        processedLabels: labels
      });

      const result = {
        type: "ternary-plot" as const,
        title: this.renderer.legendOptions?.title || this.layer?.title || "Variable Distribution",
        ternaryData,
        labels,
        visible: true
      };

      console.log('[MultivariateViz] Ternary plot legend result:', {
        type: result.type,
        dataPoints: ternaryData.length,
        labels: labels,
        firstFewDataPoints: ternaryData.slice(0, 3),
        profileColorsKeys: Object.keys(this.profileColors),
        fieldsUsed: this.fieldsUsed
      });
      return result;
    }

    // Standard legend for non-3-variable cases
    console.log('[MultivariateViz] Creating standard legend');
    const legendItems = this.renderer.uniqueValueInfos.map(info => {
      const symbol = info.symbol as any;
      let color = 'rgba(128, 128, 128, 1)'; // Default gray
      
      // Extract color from ArcGIS symbol
      if (symbol && symbol.color) {
        if (typeof symbol.color.r === 'number') {
          const alpha = symbol.color.a !== undefined ? symbol.color.a / 255 : 1;
          color = `rgba(${symbol.color.r}, ${symbol.color.g}, ${symbol.color.b}, ${alpha})`;
        } else if (Array.isArray(symbol.color)) {
          const [r, g, b, a = 255] = symbol.color;
          color = `rgba(${r}, ${g}, ${b}, ${a / 255})`;
        }
      }

    return {
        label: info.label || String(info.value),
        color: color,
        outlineColor: 'rgba(128, 128, 128, 0.5)',
        shape: 'square' as const, // Multivariate uses polygon symbols
        size: 16
      };
    });

    const result = {
      title: this.renderer.legendOptions?.title || this.layer?.title || "Multivariate Profiles",
      type: "unique-value" as const,
      items: legendItems,
      visible: true
    };

    console.log('[MultivariateViz] Standard legend result:', result);
    return result;
  }

  protected findObjectIdField(attributes: { [key: string]: any }): string {
    if (!attributes) {
      throw new Error('Cannot find Object ID field: Feature has no attributes.');
    }

    const commonOidFields = ['OBJECTID', 'ObjectID', 'FID', 'OID', '__OBJECTID', 'objectid', 'fid'];
    
    for (const fieldName of commonOidFields) {
      if (Object.prototype.hasOwnProperty.call(attributes, fieldName)) {
        console.log(`[findObjectIdField] Found OID field: ${fieldName}`);
        return fieldName;
      }
    }

    // If no standard OID field found, provide detailed error message
    const availableFields = Object.keys(attributes)
      .map(field => `${field} (${typeof attributes[field]})`)
      .join(', ');

    throw new Error(
      `No standard Object ID field found. Please ensure your data includes one of these fields: ${commonOidFields.join(', ')}. ` +
      `Available fields: ${availableFields}`
    );
  }
}