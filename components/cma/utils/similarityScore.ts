/**
 * Similarity Scoring System for CMA Comparables
 *
 * Calculates how similar a comparable property is to the subject property
 * or filter criteria center-point. Used to sort comparables by relevance.
 */

import type { CMAProperty, CMAFilters } from '../types';

/**
 * Weight configuration for similarity scoring factors
 * Total should sum to 100%
 */
export const SIMILARITY_WEIGHTS = {
  price: 0.30,          // 30% - Price proximity
  bedrooms: 0.20,       // 20% - Bedroom match
  bathrooms: 0.15,      // 15% - Bathroom match
  squareFootage: 0.20,  // 20% - Square footage proximity
  yearBuilt: 0.10,      // 10% - Year built proximity
  distance: 0.05,       // 5% - Distance from subject (if available)
} as const;

/**
 * Subject property or filter criteria reference point for comparison
 */
export interface SimilarityReference {
  price: number;
  bedrooms: number;
  bathrooms: number;
  squareFootage: number;
  yearBuilt: number;
  location?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Extract reference point from a selected property
 */
export function extractPropertyReference(property: __esri.Graphic | CMAProperty): SimilarityReference {
  // Handle both Esri Graphic and CMAProperty types
  const attrs = 'attributes' in property ? property.attributes : property;

  return {
    price: attrs.askedsold_price || attrs.price || attrs.asked_price || attrs.asking_price || 0,
    bedrooms: attrs.bedrooms || 0,
    bathrooms: attrs.bathrooms || 0,
    squareFootage: attrs.building_size || attrs.squareFootage || attrs.living_area || 0,
    yearBuilt: attrs.year_built || attrs.yearBuilt || new Date().getFullYear(),
    location: attrs.geometry ? {
      latitude: attrs.geometry.latitude,
      longitude: attrs.geometry.longitude,
    } : undefined,
  };
}

/**
 * Extract reference point from filter criteria (area pipeline)
 * Uses the center-point (average) of min/max filter values
 */
export function extractFilterReference(filters: CMAFilters): SimilarityReference {
  return {
    price: (filters.priceRange.min + filters.priceRange.max) / 2,
    bedrooms: (filters.bedrooms.min + filters.bedrooms.max) / 2,
    bathrooms: (filters.bathrooms.min + filters.bathrooms.max) / 2,
    squareFootage: (filters.squareFootage.min + filters.squareFootage.max) / 2,
    yearBuilt: (filters.yearBuilt.min + filters.yearBuilt.max) / 2,
  };
}

/**
 * Calculate proximity score for a numeric value (0-1)
 * Uses formula: 1 - (|actual - target| / range)
 * Clamped to [0, 1] range
 *
 * @param actual - Actual property value
 * @param target - Target/reference value
 * @param range - Maximum expected difference (defines 0 score threshold)
 * @returns Proximity score between 0 (far) and 1 (exact match)
 */
function calculateProximity(actual: number, target: number, range: number): number {
  if (range === 0) return actual === target ? 1 : 0;

  const difference = Math.abs(actual - target);
  const proximity = 1 - (difference / range);

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, proximity));
}

/**
 * Calculate haversine distance between two coordinates in kilometers
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate distance proximity score (0-1)
 * Within 1km = 1.0, 10km+ = 0.0, linear interpolation between
 */
function calculateDistanceProximity(distance: number): number {
  const maxDistance = 10; // km - properties 10km+ get 0 score
  return calculateProximity(distance, 0, maxDistance);
}

/**
 * Calculate comprehensive similarity score for a property
 *
 * @param property - Property to score
 * @param reference - Reference point (subject property or filter center)
 * @param priceRange - Expected price range for proximity calculation (default: ±50% of target)
 * @returns Similarity score between 0-100
 */
export function calculateSimilarityScore(
  property: CMAProperty,
  reference: SimilarityReference,
  priceRange?: number
): number {
  // Track which factors have valid data and their scores
  const factors: { score: number; weight: number; name: string }[] = [];

  // Determine price range for proximity calculation
  // Default: ±50% of reference price (e.g., $500k reference = $250k-$750k range)
  const effectivePriceRange = priceRange ?? (reference.price * 0.5);

  // Price - always include if property has valid price
  if (property.price > 0 && reference.price > 0) {
    factors.push({
      score: calculateProximity(property.price, reference.price, effectivePriceRange),
      weight: SIMILARITY_WEIGHTS.price,
      name: 'price'
    });
  }

  // Bedrooms - include if both property and reference have values
  if (property.bedrooms > 0 && reference.bedrooms > 0) {
    factors.push({
      score: calculateProximity(property.bedrooms, reference.bedrooms, 3),
      weight: SIMILARITY_WEIGHTS.bedrooms,
      name: 'bedrooms'
    });
  }

  // Bathrooms - include if both property and reference have values
  if (property.bathrooms > 0 && reference.bathrooms > 0) {
    factors.push({
      score: calculateProximity(property.bathrooms, reference.bathrooms, 3),
      weight: SIMILARITY_WEIGHTS.bathrooms,
      name: 'bathrooms'
    });
  }

  // Square footage - include if both have valid values (skip if 0 or missing)
  if (property.squareFootage > 0 && reference.squareFootage > 0) {
    factors.push({
      score: calculateProximity(property.squareFootage, reference.squareFootage, reference.squareFootage * 0.5),
      weight: SIMILARITY_WEIGHTS.squareFootage,
      name: 'squareFootage'
    });
  }

  // Year built - include if both have valid values (year > 1600 to filter out invalid data)
  if (property.yearBuilt > 1600 && reference.yearBuilt > 1600) {
    factors.push({
      score: calculateProximity(property.yearBuilt, reference.yearBuilt, 50),
      weight: SIMILARITY_WEIGHTS.yearBuilt,
      name: 'yearBuilt'
    });
  }

  // Distance score (if location data available)
  if (reference.location && property.geometry) {
    const geom = property.geometry as any;
    if (geom.latitude && geom.longitude) {
      const distance = calculateDistance(
        reference.location.latitude,
        reference.location.longitude,
        geom.latitude,
        geom.longitude
      );
      factors.push({
        score: calculateDistanceProximity(distance),
        weight: SIMILARITY_WEIGHTS.distance,
        name: 'distance'
      });
    }
  }

  // If no valid factors, return a baseline score (50%)
  if (factors.length === 0) {
    return 50;
  }

  // Calculate total weight from available factors
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);

  // Calculate weighted sum, normalized by available factors
  const weightedScore = factors.reduce((sum, f) => sum + (f.score * f.weight), 0) / totalWeight;

  // Convert to 0-100 scale
  return Math.round(weightedScore * 100);
}

/**
 * Add similarity scores to an array of properties
 *
 * @param properties - Properties to score
 * @param reference - Reference point for comparison
 * @param priceRange - Optional custom price range for proximity calculation
 * @returns Properties with similarity_score field added
 */
export function addSimilarityScores(
  properties: CMAProperty[],
  reference: SimilarityReference,
  priceRange?: number
): (CMAProperty & { similarity_score: number })[] {
  return properties.map(property => ({
    ...property,
    similarity_score: calculateSimilarityScore(property, reference, priceRange),
  }));
}

/**
 * Sort properties by similarity score (highest first)
 */
export function sortBySimilarity<T extends { similarity_score: number }>(
  properties: T[]
): T[] {
  return [...properties].sort((a, b) => b.similarity_score - a.similarity_score);
}

/**
 * Get similarity score color class for display
 */
export function getSimilarityScoreColor(score: number): string {
  if (score >= 90) return "text-green-600 font-bold";
  if (score >= 80) return "text-green-500 font-semibold";
  if (score >= 70) return "text-blue-600";
  if (score >= 60) return "text-orange-600";
  return "text-gray-600";
}

/**
 * Get similarity score badge variant
 */
export function getSimilarityScoreBadge(score: number): "default" | "secondary" | "destructive" | "outline" {
  if (score >= 80) return "default"; // Green
  if (score >= 60) return "secondary"; // Blue
  return "outline"; // Gray
}
