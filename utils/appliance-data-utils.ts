import type { ApplianceData, ApplianceLayers } from '@/types/appliance';
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine";

// Type definitions for field validation
interface FieldValidation {
  value: number;
  fieldName: string;
  layerName: string;
}

/**
 * Validates a numeric field from the feature attributes
 * @param field Field value to validate
 * @returns Validated number or 0 if invalid
 */
function validateNumericField({ value, fieldName, layerName }: FieldValidation): number {
  if (typeof value !== 'number') {
    console.warn(`Invalid ${fieldName} in ${layerName}: expected number, got ${typeof value}`);
    return 0;
  }
  if (isNaN(value)) {
    console.warn(`Invalid ${fieldName} in ${layerName}: NaN value`);
    return 0;
  }
  return value;
}

/**
 * Safely manages layer visibility for querying with proper cleanup
 */
async function withVisibleLayers<T>(
  layers: __esri.FeatureLayer[],
  callback: () => Promise<T>
): Promise<T> {
  // Store original visibility states
  const originalVisibility = new Map<__esri.FeatureLayer, boolean>();
  
  // Set up visibility changes with proper error handling
  const setupVisibility = async () => {
    for (const layer of layers) {
      if (layer && !layer.destroyed) {
        try {
          originalVisibility.set(layer, layer.visible);
          await layer.when(); // Ensure layer is loaded
          layer.visible = true;
        } catch (err) {
          console.warn(`Failed to set visibility for layer: ${err}`);
        }
      }
    }
  };

  // Restore visibility states with proper error handling
  const restoreVisibility = async () => {
    for (const layer of layers) {
      if (layer && !layer.destroyed) {
        try {
          const originalState = originalVisibility.get(layer);
          if (originalState !== undefined) {
            await layer.when();
            layer.visible = originalState;
          }
        } catch (err) {
          console.warn(`Failed to restore visibility for layer: ${err}`);
        }
      }
    }
  };

  try {
    await setupVisibility();
    const result = await callback();
    await restoreVisibility();
    return result;
  } catch (error) {
    await restoreVisibility();
    throw error;
  }
}

// Categories configuration for spending trends
const SPENDING_CATEGORIES = [
  {
    id: 'window-ac',
    name: 'Window Air Conditioners',
    currentField: 'X4070_X_I',
    projectedField: 'X4070FY_X_I'
  },
  {
    id: 'microwave',
    name: 'Microwave Ovens',
    currentField: 'X4069_X_I',
    projectedField: 'X4069FY_X_I'
  },
  {
    id: 'stoves',
    name: 'Cooking Stoves & Ovens',
    currentField: 'X4068_X_I',
    projectedField: 'X4068FY_X_I'
  },
  {
    id: 'laundry',
    name: 'Washers & Dryers',
    currentField: 'X4110_X_I',
    projectedField: 'X4110FY_X_I'
  },
  {
    id: 'refrigeration',
    name: 'Refrigerators & Freezers',
    currentField: 'X4065_X_I',
    projectedField: 'X4065FY_X_I'
  },
  {
    id: 'dishwasher',
    name: 'Dishwashers & Disposals',
    currentField: 'X4064_X_I',
    projectedField: 'X4064FY_X_I'
  },
  {
    id: 'major-appliances',
    name: 'Major Appliances',
    currentField: 'X4063_X_I',
    projectedField: 'X4063FY_X_I'
  }
];

/**
 * Fetches and processes appliance data for a given geometry
 * @param geometry The geometry to query
 * @param layerStates The available layers for querying
 * @returns Processed appliance data
 */
export const fetchApplianceData = async (
  geometry: __esri.Geometry,
  layerStates: ApplianceLayers
): Promise<ApplianceData> => {
  console.group('Fetch Appliance Data');
  console.log('Input Geometry:', geometry);
  console.log('Layer States:', layerStates);

  try {
    // Filter out null and destroyed layers
    const availabilityCheck = {
      stores: layerStates.stores.filter((layer): layer is __esri.FeatureLayer => 
        layer !== null && !layer.destroyed),
      spending: layerStates.spending.filter((layer): layer is __esri.FeatureLayer => 
        layer !== null && !layer.destroyed),
      demographics: layerStates.demographics.filter((layer): layer is __esri.FeatureLayer => 
        layer !== null && !layer.destroyed),
      storeExpenditure: layerStates.storeExpenditure.filter((layer): layer is __esri.FeatureLayer => 
        layer !== null && !layer.destroyed)
    };

    console.log('Layer Availability:', {
      stores: availabilityCheck.stores.length,
      spending: availabilityCheck.spending.length,
      demographics: availabilityCheck.demographics.length,
      storeExpenditure: availabilityCheck.storeExpenditure.length
    });

    // Validate layer availability
    const validateLayerAvailability = () => {
      const errors: string[] = [];

      if (availabilityCheck.stores.length === 0) {
        errors.push('No store layers available');
      }
      if (availabilityCheck.spending.length === 0) {
        errors.push('No spending layers available');
      }
      if (availabilityCheck.demographics.length === 0) {
        errors.push('No demographic layers available');
      }
      if (availabilityCheck.storeExpenditure.length === 0) {
        errors.push('No store expenditure layers available');
      }

      return errors;
    };

    const layerErrors = validateLayerAvailability();
    if (layerErrors.length > 0) {
      console.error('Layer Availability Errors:', layerErrors);
      throw new Error(`Insufficient layers: ${layerErrors.join(', ')}`);
    }

    // Ensure all layers are loaded before querying
    const ensureLayersLoaded = async (layers: __esri.FeatureLayer[]) => {
      await Promise.all(layers.map(layer => layer.when()));
    };

    // Collect all layers for visibility management
    const allLayers = [
      ...availabilityCheck.stores,
      ...availabilityCheck.spending,
      ...availabilityCheck.demographics,
      ...availabilityCheck.storeExpenditure
    ];

    // Ensure all layers are loaded before proceeding
    await ensureLayersLoaded(allLayers);

    return await withVisibleLayers(allLayers, async () => {
      console.log('Querying layers with managed visibility');

      // 1. Store Data Query
      const storeQuery = {
        where: "1=1",
        geometry,
        spatialRelationship: "intersects" as const,
        outFields: ['*'],
        returnGeometry: true
      };

      console.log('Executing store query');
      const storeResponses = await Promise.all(
        availabilityCheck.stores.map(layer => layer.queryFeatures(storeQuery))
      );

      const competitors = storeResponses.flatMap(response => 
        response.features.map(feature => ({
          name: feature.attributes.name || `Store ${feature.attributes.OBJECTID}`,
          distance: 0,
          marketShare: 15
        }))
      );

      // Calculate distances using geometryEngine
      competitors.forEach(competitor => {
        const feature = storeResponses.flatMap(r => r.features)
          .find(f => f.attributes.name === competitor.name);
        if (feature && feature.geometry) {
          const distance = geometryEngine.distance(
            geometry as __esri.GeometryUnion,
            feature.geometry as __esri.GeometryUnion,
            "kilometers"
          );
          competitor.distance = parseFloat(distance.toFixed(1));
        }
      });

      // 2. Spending Data Query
      const spendingQuery = {
        where: "1=1",
        geometry,
        spatialRelationship: "intersects" as const,
        outFields: ['*']
      };

      console.log('Executing spending query');
      const spendingResponses = await Promise.all(
        availabilityCheck.spending.map(layer => layer.queryFeatures(spendingQuery))
      );

      // Process spending trends by category
      const spendingTrends: Array<{
        category: string;
        current: number;
        projected: number;
        growthRate: number;
      }> = [];
      
      // Get current and projected values for each category
      SPENDING_CATEGORIES.forEach(category => {
        const currentFeature = spendingResponses.flatMap(r => r.features)
          .find(f => f.attributes[category.currentField]);
        const projectedFeature = spendingResponses.flatMap(r => r.features)
          .find(f => f.attributes[category.projectedField]);

        if (currentFeature || projectedFeature) {
          const current = validateNumericField({
            value: currentFeature?.attributes[category.currentField],
            fieldName: category.currentField,
            layerName: category.name
          });
          const projected = validateNumericField({
            value: projectedFeature?.attributes[category.projectedField],
            fieldName: category.projectedField,
            layerName: category.name
          });
          const growthRate = current > 0 ? ((projected - current) / current) * 100 : 0;

          spendingTrends.push({
            category: category.name,
            current,
            projected,
            growthRate: parseFloat(growthRate.toFixed(1))
          });
        } else {
          console.warn(`No data found for category: ${category.name}`);
        }
      });

      // 3. Demographic Data Query
      const demoQuery = {
        where: "1=1",
        geometry,
        spatialRelationship: "intersects" as const,
        outFields: ['*']
      };

      console.log('Executing demographic query');
      const demoResponses = await Promise.all(
        availabilityCheck.demographics.map(layer => layer.queryFeatures(demoQuery))
      );

      // Process demographic data
      const gasRangeFeature = demoResponses.flatMap(r => r.features)
        .find(f => f.attributes['MP16074H_B_I']);
      const electricRangeFeature = demoResponses.flatMap(r => r.features)
        .find(f => f.attributes['MP16073H_B_I']);
      const recentBuyersFeature = demoResponses.flatMap(r => r.features)
        .find(f => f.attributes['MP16061H_B_I']);
      const recentMoversFeature = demoResponses.flatMap(r => r.features)
        .find(f => f.attributes['ACSOMV2021_P']);
      const housingUnitsFeature = demoResponses.flatMap(r => r.features)
        .find(f => f.attributes['TSHU23_CY']);

      // 4. Store Expenditure Query
      const expenditureQuery = {
        where: "1=1",
        geometry,
        spatialRelationship: "intersects" as const,
        outFields: ['*']
      };

      console.log('Executing expenditure query');
      const expenditureResponses = await Promise.all(
        availabilityCheck.storeExpenditure.map(layer => layer.queryFeatures(expenditureQuery))
      );

      const expenditureFeatures = expenditureResponses.flatMap(response => response.features);
      const expenditureFeature = expenditureFeatures[0] || { attributes: {} };

      // Calculate growth rate from major appliances trend
      const majorApplianceTrend = spendingTrends.find(t => t.category === 'Major Appliances');
      const growthRate = majorApplianceTrend?.growthRate || 0;

      // Validate numeric fields for demographics
      const gasRangeIndex = validateNumericField({
        value: gasRangeFeature?.attributes['MP16074H_B_I'],
        fieldName: 'MP16074H_B_I',
        layerName: 'Gas Range Index'
      });

      const electricRangeIndex = validateNumericField({
        value: electricRangeFeature?.attributes['MP16073H_B_I'],
        fieldName: 'MP16073H_B_I',
        layerName: 'Electric Range Index'
      });

      const recentBuyersIndex = validateNumericField({
        value: recentBuyersFeature?.attributes['MP16061H_B_I'],
        fieldName: 'MP16061H_B_I',
        layerName: 'Recent Buyers Index'
      });

      const recentMovers = validateNumericField({
        value: recentMoversFeature?.attributes['ACSOMV2021_P'],
        fieldName: 'ACSOMV2021_P',
        layerName: 'Recent Movers'
      });

      const housingUnits = validateNumericField({
        value: housingUnitsFeature?.attributes['TSHU23_CY'],
        fieldName: 'TSHU23_CY',
        layerName: 'Housing Units'
      });

      const storeIndex = validateNumericField({
        value: expenditureFeature.attributes['IND443_X_I'],
        fieldName: 'IND443_X_I',
        layerName: 'Store Expenditure'
      });

      const result: ApplianceData = {
        marketOverview: {
          totalPotential: storeIndex,
          growthRate: growthRate,
          storeIndex: storeIndex,
          housingUnits: housingUnits
        },
        competitors,
        spendingTrends,
        demographics: {
          medianIncome: 75000, // Default value
          homeOwnership: 65.5,  // Default value
          recentMovers,
          gasRangeIndex,
          electricRangeIndex,
          recentBuyersIndex
        }
      };

      console.log('Final Appliance Data:', result);
      console.groupEnd();

      return result;
    });

  } catch (error) {
    console.error('Comprehensive Appliance Data Fetch Error:', error);
    console.groupEnd();
    if (error instanceof Error) {
      throw new Error(`Appliance data fetch failed: ${error.message}`);
    } else {
      throw new Error('Unknown error occurred while fetching appliance data');
    }
  }
};