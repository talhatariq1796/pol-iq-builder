import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type Theme = 'light' | 'dark' | 'system';

export const themes: Theme[] = ['light', 'dark', 'system'];

export const themeConfig = {
  light: {
    background: 'hsl(0 0% 100%)',
    foreground: 'hsl(0 0% 3.9%)',
    card: 'hsl(0 0% 100%)',
    'card-foreground': 'hsl(0 0% 3.9%)',
    popover: 'hsl(0 0% 100%)',
    'popover-foreground': 'hsl(0 0% 3.9%)',
    primary: 'hsl(0 0% 9%)',
    'primary-foreground': 'hsl(0 0% 98%)',
    secondary: 'hsl(0 0% 96.1%)',
    'secondary-foreground': 'hsl(0 0% 9%)',
    muted: 'hsl(0 0% 96.1%)',
    'muted-foreground': 'hsl(0 0% 45.1%)',
    accent: 'hsl(0 0% 96.1%)',
    'accent-foreground': 'hsl(0 0% 9%)',
    destructive: 'hsl(0 84.2% 60.2%)',
    'destructive-foreground': 'hsl(0 0% 98%)',
    border: 'hsl(0 0% 89.8%)',
    input: 'hsl(0 0% 89.8%)',
    ring: 'hsl(0 0% 3.9%)',
    radius: '0.5rem',
  },
  dark: {
    background: 'hsl(0 0% 3.9%)',
    foreground: 'hsl(0 0% 98%)',
    card: 'hsl(0 0% 3.9%)',
    'card-foreground': 'hsl(0 0% 98%)',
    popover: 'hsl(0 0% 3.9%)',
    'popover-foreground': 'hsl(0 0% 98%)',
    primary: 'hsl(0 0% 98%)',
    'primary-foreground': 'hsl(0 0% 9%)',
    secondary: 'hsl(0 0% 14.9%)',
    'secondary-foreground': 'hsl(0 0% 98%)',
    muted: 'hsl(0 0% 14.9%)',
    'muted-foreground': 'hsl(0 0% 63.9%)',
    accent: 'hsl(0 0% 14.9%)',
    'accent-foreground': 'hsl(0 0% 98%)',
    destructive: 'hsl(0 62.8% 30.6%)',
    'destructive-foreground': 'hsl(0 0% 98%)',
    border: 'hsl(0 0% 14.9%)',
    input: 'hsl(0 0% 14.9%)',
    ring: 'hsl(0 0% 83.1%)',
    radius: '0.5rem',
  },
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getThemeColor(theme: Theme, color: keyof typeof themeConfig.light) {
  if (theme === 'system') {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
    return themeConfig[systemTheme][color];
  }
  return themeConfig[theme][color];
}

export function getThemeColors(theme: Theme) {
  if (theme === 'system') {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
    return themeConfig[systemTheme];
  }
  return themeConfig[theme];
} 