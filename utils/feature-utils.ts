// src/utils/feature-utils.ts

import { Feature, Point } from 'geojson';

/**
 * Calculates the centroid of a set of point features
 * @param features Array of GeoJSON features
 * @returns Tuple of [longitude, latitude]
 */
export function calculateCentroid(features: Feature[]): [number, number] {
  // Filter and type guard for point features
  const pointFeatures = features.filter(
    (feature): feature is Feature & { geometry: Point } => 
      feature.geometry.type === 'Point'
  );

  if (pointFeatures.length === 0) {
    throw new Error('No point features found for centroid calculation');
  }

  // Reduce to calculate average coordinates
  const sumX = pointFeatures.reduce((sum, feature) => 
    sum + feature.geometry.coordinates[0], 0);
  const sumY = pointFeatures.reduce((sum, feature) => 
    sum + feature.geometry.coordinates[1], 0);

  return [
    sumX / pointFeatures.length, 
    sumY / pointFeatures.length
  ];
}

/**
 * Filters features within a specified radius of a center point
 * @param features Array of GeoJSON features
 * @param center Center point [longitude, latitude]
 * @param radius Radius in coordinate units
 * @returns Filtered array of features
 */
export function filterFeaturesWithinRadius(
  features: Feature[], 
  center: [number, number], 
  radius: number
): Feature[] {
  const [centerX, centerY] = center;

  return features.filter(feature => {
    // Only process point features
    if (feature.geometry.type !== 'Point') return false;

    const [featureX, featureY] = feature.geometry.coordinates;

    // Calculate Euclidean distance
    const distance = Math.sqrt(
      Math.pow(featureX - centerX, 2) + 
      Math.pow(featureY - centerY, 2)
    );

    return distance <= radius;
  });
}

/**
 * Calculates the bounding box for a set of features
 * @param features Array of GeoJSON features
 * @returns Bounding box [minX, minY, maxX, maxY]
 */
export function calculateBoundingBox(features: Feature[]): [number, number, number, number] {
  // Filter and type guard for point features
  const pointFeatures = features.filter(
    (feature): feature is Feature & { geometry: Point } => 
      feature.geometry.type === 'Point'
  );

  if (pointFeatures.length === 0) {
    throw new Error('No point features found for bounding box calculation');
  }

  // Extract coordinates
  const longitudes = pointFeatures.map(f => f.geometry.coordinates[0]);
  const latitudes = pointFeatures.map(f => f.geometry.coordinates[1]);

  return [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes)
  ];
}

/**
 * Checks if a point is within a bounding box
 * @param point Point coordinates [longitude, latitude]
 * @param boundingBox Bounding box [minX, minY, maxX, maxY]
 * @returns Boolean indicating if point is within the box
 */
export function isPointInBoundingBox(
  point: [number, number], 
  boundingBox: [number, number, number, number]
): boolean {
  const [pointX, pointY] = point;
  const [minX, minY, maxX, maxY] = boundingBox;

  return (
    pointX >= minX && pointX <= maxX &&
    pointY >= minY && pointY <= maxY
  );
}