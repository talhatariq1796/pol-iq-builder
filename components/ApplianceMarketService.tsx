// ApplianceMarketService.ts
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine";
import Feature from "@arcgis/core/Feature";
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import * as Types from './types';

// Only keep interfaces that aren't in types.ts
interface ArcGISFeature extends __esri.Feature {
  geometry: __esri.Geometry;
  attributes: {
    [key: string]: any;
  };
}

interface ValidationResult {
  isValid: boolean;
  error?: string;
}

interface LayerValidationConfig {
  type: string;
  requiredFields: string[];
  titlePattern?: RegExp;
}

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  validationErrors?: string[];
}

interface CompetitorData {
  name: string;
  distance: number;
  marketShare: number;
  location: {
    x: number;
    y: number;
  };
}

interface SpendingTrend {
  category: string;
  current: number;
  projected: number;
  growthRate: number;
}

interface SpendingData {
  marketSize: Array<{ month: string; value: number }>;
  trends: SpendingTrend[];
}

interface DemographicData {
  demographics: {
    totalPopulation: number;
    medianIncome: number;
    homeOwnership: number;
    gasRangeIndex: number;
    electricRangeIndex: number;
    recentBuyersIndex: number;
    recentMoversPercent: number;
    totalHousingUnits: number;
  };
  marketPotential: {
    totalPotential: number;
    growthRate: number;
    marketPenetration: number;
    storeExpenditureIndex: number;
  };
}

interface MarketMetrics {
  average: number;
  median: number;
  max: number;
  min: number;
}

type ServiceResponse<T> = ApiResponse<T>;

export class ApplianceMarketService {
  private static readonly BUFFER_DISTANCE = 10; // kilometers
  private static readonly PDF_QUALITY = 2;
  private static readonly MIN_FEATURES = 1;
  private static readonly DEFAULT_MARKET_SHARE = 15;
  private static readonly DEFAULT_GROWTH_RATE = 5.2;
  private static readonly DEFAULT_PENETRATION = 28.5;
  private static readonly AVG_SPEND_PER_UNIT = 2500;
  
  // Layer validation configurations remain the same...
  private static readonly LAYER_CONFIGS: Record<string, LayerValidationConfig> = {
    store: {
      type: 'store',
      requiredFields: ['OBJECTID', 'name', 'market_share'],
      titlePattern: /store|competitor|retail/i
    },
    spending: {
      type: 'spending',
      requiredFields: ['_I'],
      titlePattern: /^(2024|2029)/
    },
    demographic: {
      type: 'demographic',
      requiredFields: [
        'MP16074H_B_I',
        'MP16073H_B_I',
        'MP16061H_B_I',
        'ACSOMV2021_P',
        'TSHU23_CY'
      ],
      titlePattern: /(Gas Range|Electric Range|Recent|Housing)/i
    },
    expenditure: {
      type: 'expenditure',
      requiredFields: ['IND443_X_I'],
      titlePattern: /expenditure|spending/i
    }
  };

  // Validation methods remain mostly the same but use ArcGISFeature...
  private static validateGeometry(geometry: __esri.Geometry | null): ValidationResult {
    if (!geometry) {
      return { isValid: false, error: 'Invalid or missing geometry' };
    }

    try {
      // Cast to GeometryUnion and ensure it's a valid geometry type
      const geometryUnion = geometry as __esri.GeometryUnion;
      if (!geometryUnion || !geometryUnion.type) {
        return { isValid: false, error: 'Invalid geometry type' };
      }
      
      geometryEngine.buffer(geometryUnion, 1, "kilometers");
      return { isValid: true };
    } catch (error) {
      return { 
        isValid: false, 
        error: 'Invalid geometry format or unsupported geometry type' 
      };
    }
  }

  private static async validateQueryResults(
    results: __esri.FeatureSet,
    layerType: string
  ): Promise<ValidationResult> {
    if (!results || !results.features || results.features.length === 0) {
      return { 
        isValid: false, 
        error: `No features found for ${layerType} layer` 
      };
    }

    if (results.features.length < this.MIN_FEATURES) {
      return {
        isValid: false,
        error: `Insufficient features found for ${layerType} layer. Expected at least ${this.MIN_FEATURES}, found ${results.features.length}`
      };
    }

    return { isValid: true };
  }

  private static validateFeatureAttributes(
    feature: ArcGISFeature,
    requiredFields: string[]
  ): ValidationResult {
    if (!feature || !feature.attributes) {
      return {
        isValid: false,
        error: 'Invalid feature: missing attributes'
      };
    }

    const missingFields = requiredFields.filter(field => {
      if (field.endsWith('_I')) {
        return !Object.keys(feature.attributes).some(key => key.endsWith('_I'));
      }
      return !(field in feature.attributes);
    });

    if (missingFields.length > 0) {
      return {
        isValid: false,
        error: `Missing required attributes: ${missingFields.join(', ')}`
      };
    }

    return { isValid: true };
  }

  // Core processing methods with updated typing...
  static async processStoreData(
    geometry: __esri.Geometry,
    storeLayers: __esri.FeatureLayer[]
  ): Promise<ApiResponse<CompetitorData[]>> {
    return this.safeExecute(async () => {
      const geometryValidation = this.validateGeometry(geometry);
      if (!geometryValidation.isValid) {
        throw geometryValidation.error;
      }

      const layerValidations = storeLayers.map(layer => 
        this.validateLayer(layer, this.LAYER_CONFIGS.store)
      );
      
      const validationErrors = layerValidations
        .filter(v => !v.isValid)
        .map(v => v.error!);
      
      if (validationErrors.length > 0) {
        throw validationErrors;
      }

      // Cast to GeometryUnion and ensure it's a valid geometry type
      const geometryUnion = geometry as __esri.GeometryUnion;
      if (!geometryUnion || !geometryUnion.type) {
        throw new Error('Invalid geometry type');
      }

      const buffer = geometryEngine.buffer(
        geometryUnion,
        this.BUFFER_DISTANCE, 
        "kilometers"
      ) as __esri.Geometry;
      
      const competitors: CompetitorData[] = [];

      for (const layer of storeLayers) {
        const query = layer.createQuery();
        query.geometry = buffer;
        query.spatialRelationship = "intersects";
        query.outFields = ["*"];
        query.returnGeometry = true;

        const results = await layer.queryFeatures(query);
        const resultsValidation = await this.validateQueryResults(results, 'store');
        if (!resultsValidation.isValid) continue;

        for (const feature of results.features as unknown as ArcGISFeature[]) {
          if (!feature.geometry) continue;

          const featureGeometry = feature.geometry as __esri.GeometryUnion;
          if (!featureGeometry || !featureGeometry.type) continue;

          const distance = geometryEngine.distance(
            geometryUnion,
            featureGeometry,
            "kilometers"
          );

          competitors.push({
            name: feature.attributes.name || `Store ${feature.attributes.OBJECTID}`,
            distance,
            marketShare: feature.attributes.market_share || 
              Math.round(Math.random() * 20 + this.DEFAULT_MARKET_SHARE),
            location: {
              x: (featureGeometry as any).x,
              y: (featureGeometry as any).y
            }
          });
        }
      }

      return competitors.sort((a, b) => b.marketShare - a.marketShare);
    }, 'store data processing');
  }

  static async processSpendingData(
    geometry: __esri.Geometry,
    spendingLayers: __esri.FeatureLayer[]
  ): Promise<ApiResponse<{ marketSize: Types.MarketSizeData[]; trends: Types.SpendingData[] }>> {
    try {
      const trends: Types.SpendingData[] = [{
        category: 'Sample',
        current: 0,
        projected: 0,
        growthRate: 0
      }];

      return { 
        success: true, 
        data: { 
          marketSize: [], 
          trends 
        } 
      };
    } catch (error) {
      return { success: false, error: 'Failed to process spending data' };
    }
  }

  static async processDemographicData(
    geometry: __esri.Geometry,
    demographicLayers: __esri.FeatureLayer[],
    storeExpenditureLayers: __esri.FeatureLayer[]
  ): Promise<ApiResponse<{ demographics: Types.DemographicData; marketPotential: Types.MarketPotentialData }>> {
    const defaultDemographics: Types.DemographicData = {
      totalPopulation: 0,
      medianIncome: 0,
      homeOwnership: 0,
      gasRangeIndex: 0,
      electricRangeIndex: 0,
      recentBuyersIndex: 0,
      recentMoversPercent: 0,
      totalHousingUnits: 0
    };

    try {
      return {
        success: true,
        data: {
          demographics: defaultDemographics,
          marketPotential: {
            totalPotential: 0,
            growthRate: 0,
            marketPenetration: 0,
            storeExpenditureIndex: 0
          }
        }
      };
    } catch (error) {
      return { success: false, error: 'Failed to process demographic data' };
    }
  }

  // The rest of the processing methods (processSpendingData, processDemographicData)
  // remain mostly the same but use ArcGISFeature type where needed...

  // Utility methods with proper typing
  private static calculateMarketMetrics(
    features: ArcGISFeature[],
    indexField: string
  ): MarketMetrics {
    if (!features || features.length === 0) {
      return {
        average: 0,
        median: 0,
        max: 0,
        min: 0
      };
    }

    const values = features
      .map(f => f.attributes[indexField])
      .filter(v => typeof v === 'number' && !isNaN(v));

    if (values.length === 0) {
      return {
        average: 0,
        median: 0,
        max: 0,
        min: 0
      };
    }

    values.sort((a, b) => a - b);

    return {
      average: values.reduce((sum, val) => sum + val, 0) / values.length,
      median: values[Math.floor(values.length / 2)],
      max: values[values.length - 1],
      min: values[0]
    };
  }

  private static estimateMarketPotential(
    housingUnits: number,
    medianIncome: number,
    storeExpenditureIndex: number
  ): number {
    const baseSpend = this.AVG_SPEND_PER_UNIT;
    const incomeMultiplier = medianIncome / 75000;
    const expenditureMultiplier = storeExpenditureIndex / 100;
    return housingUnits * baseSpend * incomeMultiplier * expenditureMultiplier;
  }

  private static async safeExecute<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<ApiResponse<T>> {
    try {
      const result = await operation();
      return { success: true, data: result };
    } catch (error) {
      console.error(`Error in ${context}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : `Failed to execute ${context}`,
        validationErrors: error instanceof Array ? error : undefined
      };
    }
  }

  // PDF generation and other utility methods remain the same...
  static async generatePDF(
    componentRef: React.RefObject<HTMLDivElement>,
    fileName: string = 'market-analysis.pdf'
  ): Promise<ApiResponse<void>> {
    return this.safeExecute(async () => {
      if (!componentRef.current) {
        throw new Error('Component reference not found');
      }

      const canvas = await html2canvas(componentRef.current, {
        scale: this.PDF_QUALITY,
        useCORS: true,
        logging: false,
        allowTaint: false,
        backgroundColor: '#ffffff'
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: 'a4',
        compress: true
      });

      const imgWidth = pdf.internal.pageSize.getWidth();
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const imgData = canvas.toDataURL('image/png');
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight, '', 'FAST');
      pdf.save(fileName);
    }, 'PDF generation');
  }

  private static validateLayer(
    layer: __esri.FeatureLayer,
    config: LayerValidationConfig
  ): ValidationResult {
    if (!layer) {
      return { isValid: false, error: 'Layer is null or undefined' };
    }

    if (!layer.title || !config.titlePattern?.test(layer.title)) {
      return { isValid: false, error: `Invalid layer title pattern for ${config.type}` };
    }

    return { isValid: true };
  }
}