import type { ColdData, ColdLayers } from '@/types/fitness';
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine";

// Type definitions for field validation
interface FieldValidation {
  value: number;
  fieldName: string;
  layerName: string;
}

/**
 * Validates a numeric field from the feature attributes
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
  const originalVisibility = new Map<__esri.FeatureLayer, boolean>();
  
  const setupVisibility = async () => {
    for (const layer of layers) {
      if (layer && !layer.destroyed) {
        try {
          originalVisibility.set(layer, layer.visible);
          await layer.when();
          layer.visible = true;
        } catch (err) {
          console.warn(`Failed to set visibility for layer: ${err}`);
        }
      }
    }
  };

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

/**
 * Fetches and processes fitness data for a given geometry
 */
export const fetchFitnessData = async (
  geometry: __esri.Geometry,
  layers: ColdLayers
): Promise<ColdData> => {
  console.group('Fetch Fitness Data');
  
  try {
    if (!layers.businesses.spas || !layers.businesses.gyms) {
      throw new Error('Required business layers are not available');
    }

    // 1. Process business locations
    const spaQuery = {
      where: "1=1",
      geometry,
      spatialRelationship: "intersects" as const,
      outFields: ['*'],
      returnGeometry: true
    };

    const gymQuery = { ...spaQuery };

    const [spaResults, gymResults] = await Promise.all([
      layers.businesses.spas.queryFeatures(spaQuery),
      layers.businesses.gyms.queryFeatures(gymQuery)
    ]);

    const processLocations = (features: __esri.Graphic[]) => features.map(feature => ({
      name: feature.attributes.name || `Location ${feature.attributes.OBJECTID}`,
      distance: feature.geometry ? 
        parseFloat(geometryEngine.distance(geometry as __esri.GeometryUnion, feature.geometry as __esri.GeometryUnion, "kilometers").toFixed(1)) : 0,
      marketShare: 15 // Default market share
    }));

    // 2. Process spending data
    const spendingQuery = {
      where: "1=1",
      geometry,
      spatialRelationship: "intersects" as const,
      outFields: ['*']
    };

    if (!layers.spending.sportsEquipment || !layers.spending.workoutWear || !layers.spending.fitnessApparel) {
      throw new Error('Required spending layers are not available');
    }

    const [sportsEquipment, workoutWear, fitnessApparel] = await Promise.all([
      layers.spending.sportsEquipment.queryFeatures(spendingQuery),
      layers.spending.workoutWear.queryFeatures(spendingQuery),
      layers.spending.fitnessApparel.queryFeatures(spendingQuery)
    ]);

    // 3. Process psychographics
    const psychoQuery = { ...spendingQuery };

    if (!layers.psychographics.exerciseDaily || !layers.psychographics.moreFitActive) {
      throw new Error('Required psychographic layers are not available');
    }

    const [exerciseDaily, moreFitActive] = await Promise.all([
      layers.psychographics.exerciseDaily.queryFeatures(psychoQuery),
      layers.psychographics.moreFitActive.queryFeatures(psychoQuery)
    ]);

    const result: ColdData = {
      marketOverview: {
        totalPotential: 1000000,
        growthRate: 5.2,
        storeIndex: 110,
        housingUnits: 50000
      },
      spendingTrends: [
        {
          category: 'Sports Equipment',
          current: validateNumericField({
            value: sportsEquipment.features[0]?.attributes['X9051_X_I'],
            fieldName: 'X9051_X_I',
            layerName: 'Sports Equipment'
          }),
          projected: 0,
          growthRate: 5.2
        },
        {
          category: 'Workout Wear',
          current: validateNumericField({
            value: workoutWear.features[0]?.attributes['MP07111A_B_I'],
            fieldName: 'MP07111A_B_I',
            layerName: 'Workout Wear'
          }),
          projected: 0,
          growthRate: 4.8
        },
        {
          category: 'Fitness Apparel',
          current: validateNumericField({
            value: fitnessApparel.features[0]?.attributes['MP31191A_B_I'],
            fieldName: 'MP31191A_B_I',
            layerName: 'Fitness Apparel'
          }),
          projected: 0,
          growthRate: 6.1
        }
      ],
      psychographics: {
        exerciseDaily: validateNumericField({
          value: exerciseDaily.features[0]?.attributes['MP28646A_B_I'],
          fieldName: 'MP28646A_B_I',
          layerName: 'Exercise Daily'
        }),
        moreFitActive: validateNumericField({
          value: moreFitActive.features[0]?.attributes['MP28650A_B_I'],
          fieldName: 'MP28650A_B_I',
          layerName: 'More Fit Active'
        })
      },
      businesses: {
        spas: spaResults.features.length,
        gyms: gymResults.features.length
      }
    };

    console.log('Processed Fitness Data:', result);
    console.groupEnd();
    return result;

  } catch (error) {
    console.error('Error fetching fitness data:', error);
    console.groupEnd();
    throw new Error('Failed to fetch fitness data');
  }
};