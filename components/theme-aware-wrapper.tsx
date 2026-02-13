import { useTheme } from './theme-provider';
import { cn } from '@/lib/theme-config';

interface ThemeAwareWrapperProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'card' | 'popover';
}

export function ThemeAwareWrapper({
  children,
  className,
  variant = 'default',
}: ThemeAwareWrapperProps) {
  const { theme } = useTheme();

  const baseStyles = 'theme-transition';
  const variantStyles = {
    default: 'bg-background text-foreground',
    card: 'bg-card text-card-foreground rounded-lg border shadow-sm p-4',
    popover: 'bg-popover text-popover-foreground rounded-md border shadow-md p-2',
  };

  return (
    <div
      className={cn(
        baseStyles,
        variantStyles[variant],
        className
      )}
      data-theme={theme}
    >
      {children}
    </div>
  );
} 