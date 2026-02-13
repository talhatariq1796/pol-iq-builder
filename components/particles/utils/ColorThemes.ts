// Brand color themes and shades for particle effects

export interface ColorTheme {
  primary: string;
  shades: string[];
  accents: string[]; // Accent colors for variety
  name: 'green' | 'red';
}

// Green theme based on #33a852
export const GREEN_THEME: ColorTheme = {
  primary: '#33a852',
  shades: [
    '#2d9649', // Darker green
    '#27843f', // Dark green
    '#33a852', // Primary green
    '#4db15c', // Light green
    '#66bc6f', // Lighter green
    '#7fc582', // Very light green
  ],
  accents: [
    '#EA4335', // Red accent
    '#f55447', // Light red accent
    '#6b7280', // Grey accent
    '#9ca3af', // Light grey accent
  ],
  name: 'green'
};

// Red theme based on #EA4335
export const RED_THEME: ColorTheme = {
  primary: '#EA4335',
  shades: [
    '#d93d32', // Darker red
    '#c8362b', // Dark red
    '#EA4335', // Primary red
    '#f55447', // Light red
    '#ff6659', // Lighter red
    '#ff7f71', // Very light red
  ],
  accents: [
    '#33a852', // Green accent
    '#4db15c', // Light green accent
    '#6b7280', // Grey accent
    '#9ca3af', // Light grey accent
  ],
  name: 'red'
};

export const COLOR_THEMES = [GREEN_THEME, RED_THEME];

// Get a random color theme
export const getRandomColorTheme = (): ColorTheme => {
  return Math.random() > 0.5 ? GREEN_THEME : RED_THEME;
};

// Get a random color from a theme
export const getRandomColorFromTheme = (theme: ColorTheme): string => {
  return theme.shades[Math.floor(Math.random() * theme.shades.length)];
};

// Get multiple random colors from a theme (no duplicates)
export const getRandomColorsFromTheme = (theme: ColorTheme, count: number): string[] => {
  const shuffled = [...theme.shades].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, theme.shades.length));
};

// Get a mixed color palette (primarily theme colors with some accents)
export const getMixedColorPalette = (theme: ColorTheme): string[] => {
  // 70% primary theme colors, 30% accent colors
  const primaryCount = Math.ceil(theme.shades.length * 0.7);
  const accentCount = Math.min(2, theme.accents.length); // Max 2 accent colors
  
  const primaryColors = getRandomColorsFromTheme(theme, primaryCount);
  const accentColors = theme.accents.slice(0, accentCount);
  
  return [...primaryColors, ...accentColors];
};

// Get a color from mixed palette
export const getRandomMixedColor = (theme: ColorTheme): string => {
  const mixedPalette = getMixedColorPalette(theme);
  return mixedPalette[Math.floor(Math.random() * mixedPalette.length)];
};