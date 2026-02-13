/**
 * Firefly Color Conversion Utility
 * 
 * Converts old red-green color schemes to Firefly colors
 */

// Firefly color mappings
export const FIREFLY_COLOR_MAPPINGS = {
  // Old colors -> New Firefly colors
  '#d73027': '#ff0040', // Red -> Firefly Deep Pink
  '#fdae61': '#ffbf00', // Orange -> Firefly Orange
  '#a6d96a': '#00ff40', // Light Green -> Firefly Lime Green  
  '#1a9850': '#00ff80', // Dark Green -> Firefly Bright Green
};

// RGB equivalents with opacity
export const FIREFLY_RGB_MAPPINGS = {
  // Old RGB -> New Firefly RGB (with standard 0.6 opacity)
  '[215, 48, 39, 0.6]': '[255, 0, 64, 0.6]',     // Red -> Firefly Deep Pink
  '[253, 174, 97, 0.6]': '[255, 191, 0, 0.6]',   // Orange -> Firefly Orange
  '[166, 217, 106, 0.6]': '[0, 255, 64, 0.6]',   // Light Green -> Firefly Lime Green
  '[26, 152, 80, 0.6]': '[0, 255, 128, 0.6]',    // Dark Green -> Firefly Bright Green
};

// RGBA string equivalents
export const FIREFLY_RGBA_MAPPINGS = {
  'rgba(215, 48, 39, 0.6)': 'rgba(255, 0, 64, 0.6)',
  'rgba(253, 174, 97, 0.6)': 'rgba(255, 191, 0, 0.6)',
  'rgba(166, 217, 106, 0.6)': 'rgba(0, 255, 64, 0.6)',
  'rgba(26, 152, 80, 0.6)': 'rgba(0, 255, 128, 0.6)',
};

/**
 * Convert hex color to Firefly equivalent
 */
export function convertToFireflyHex(oldColor: string): string {
  return FIREFLY_COLOR_MAPPINGS[oldColor as keyof typeof FIREFLY_COLOR_MAPPINGS] || oldColor;
}

/**
 * Convert RGB array to Firefly equivalent
 */
export function convertToFireflyRGB(oldRGB: string): string {
  return FIREFLY_RGB_MAPPINGS[oldRGB as keyof typeof FIREFLY_RGB_MAPPINGS] || oldRGB;
}

/**
 * Convert RGBA string to Firefly equivalent
 */
export function convertToFireflyRGBA(oldRGBA: string): string {
  return FIREFLY_RGBA_MAPPINGS[oldRGBA as keyof typeof FIREFLY_RGBA_MAPPINGS] || oldRGBA;
}

/**
 * Standard Firefly color scheme for 4-class visualizations
 */
export const FIREFLY_STANDARD_SCHEME = [
  '#ff0040', // Firefly Deep Pink (lowest values)
  '#ffbf00', // Firefly Orange 
  '#00ff40', // Firefly Lime Green
  '#00ff80'  // Firefly Bright Green (highest values)
];

/**
 * Standard Firefly RGB scheme with opacity
 */
export const FIREFLY_STANDARD_RGB_SCHEME = [
  [255, 0, 64, 0.6],     // Firefly Deep Pink
  [255, 191, 0, 0.6],    // Firefly Orange
  [0, 255, 64, 0.6],     // Firefly Lime Green
  [0, 255, 128, 0.6]     // Firefly Bright Green
];