import { LocalGeospatialFeature } from '../types/geospatial';

export function calculateExtentFromFeatures(features: LocalGeospatialFeature[]): { xmin: number; ymin: number; xmax: number; ymax: number } | null {
  if (!features.length) return null;

  let xmin = Infinity;
  let ymin = Infinity;
  let xmax = -Infinity;
  let ymax = -Infinity;

  features.forEach(feature => {
    if (!feature.geometry) return;
    
    const coords = feature.geometry.coordinates;
    if (Array.isArray(coords[0])) {
      // Handle polygon or line
      const flattened = (coords as number[][]).flat();
      for (let i = 0; i < flattened.length; i += 2) {
        const x = flattened[i];
        const y = flattened[i + 1];
        xmin = Math.min(xmin, x);
        ymin = Math.min(ymin, y);
        xmax = Math.max(xmax, x);
        ymax = Math.max(ymax, y);
      }
    } else {
      // Handle point
      const [x, y] = coords as number[];
      xmin = Math.min(xmin, x);
      ymin = Math.min(ymin, y);
      xmax = Math.max(xmax, x);
      ymax = Math.max(ymax, y);
    }
  });

  return { xmin, ymin, xmax, ymax };
} 