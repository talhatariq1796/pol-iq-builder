'use client';

import React, { useState, useCallback, useEffect, createContext, useContext } from 'react';

// ============================================================================
// Types
// ============================================================================

export type BreakpointSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type PanelPosition = 'left' | 'right' | 'bottom' | 'full';

export interface ResponsiveContextValue {
  breakpoint: BreakpointSize;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
  panelPosition: PanelPosition;
  isPanelOpen: boolean;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  setPanelPosition: (position: PanelPosition) => void;
}

export interface ResponsiveLayoutProps {
  children: React.ReactNode;
  aiPanel: React.ReactNode;
  mapCanvas: React.ReactNode;
  defaultPanelOpen?: boolean;
  panelWidth?: number;
  mobilePanelHeight?: string;
}

// ============================================================================
// Breakpoint Configuration
// ============================================================================

const BREAKPOINTS = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

// ============================================================================
// Context
// ============================================================================

const ResponsiveContext = createContext<ResponsiveContextValue | null>(null);

export const useResponsive = (): ResponsiveContextValue => {
  const context = useContext(ResponsiveContext);
  if (!context) {
    throw new Error('useResponsive must be used within ResponsiveProvider');
  }
  return context;
};

// ============================================================================
// Hook: useBreakpoint
// ============================================================================

export function useBreakpoint(): {
  breakpoint: BreakpointSize;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
} {
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // Debounced resize handler
    let timeoutId: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 100);
    };

    window.addEventListener('resize', debouncedResize);
    handleResize(); // Initial call

    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(timeoutId);
    };
  }, []);

  const getBreakpoint = (width: number): BreakpointSize => {
    if (width >= BREAKPOINTS['2xl']) return '2xl';
    if (width >= BREAKPOINTS.xl) return 'xl';
    if (width >= BREAKPOINTS.lg) return 'lg';
    if (width >= BREAKPOINTS.md) return 'md';
    if (width >= BREAKPOINTS.sm) return 'sm';
    return 'xs';
  };

  const breakpoint = getBreakpoint(dimensions.width);

  return {
    breakpoint,
    isMobile: dimensions.width < BREAKPOINTS.md,
    isTablet: dimensions.width >= BREAKPOINTS.md && dimensions.width < BREAKPOINTS.lg,
    isDesktop: dimensions.width >= BREAKPOINTS.lg,
    width: dimensions.width,
    height: dimensions.height,
  };
}

// ============================================================================
// Responsive Provider
// ============================================================================

export const ResponsiveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const breakpointInfo = useBreakpoint();
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [panelPosition, setPanelPosition] = useState<PanelPosition>('left');

  // Auto-adjust panel position based on screen size
  useEffect(() => {
    if (breakpointInfo.isMobile) {
      setPanelPosition('bottom');
      setIsPanelOpen(false); // Start closed on mobile
    } else if (breakpointInfo.isTablet) {
      setPanelPosition('left');
      setIsPanelOpen(true);
    } else {
      setPanelPosition('left');
      setIsPanelOpen(true);
    }
  }, [breakpointInfo.isMobile, breakpointInfo.isTablet]);

  const togglePanel = useCallback(() => setIsPanelOpen((prev: boolean) => !prev), []);
  const openPanel = useCallback(() => setIsPanelOpen(true), []);
  const closePanel = useCallback(() => setIsPanelOpen(false), []);

  const value: ResponsiveContextValue = {
    ...breakpointInfo,
    panelPosition,
    isPanelOpen,
    togglePanel,
    openPanel,
    closePanel,
    setPanelPosition,
  };

  return (
    <ResponsiveContext.Provider value={value}>
      {children}
    </ResponsiveContext.Provider>
  );
};

// ============================================================================
// Responsive Layout Component
// ============================================================================

export const ResponsiveLayout: React.FC<ResponsiveLayoutProps> = ({
  children,
  aiPanel,
  mapCanvas,
  defaultPanelOpen = true,
  panelWidth = 400,
  mobilePanelHeight = '60vh',
}) => {
  const responsive = useResponsive();
  const { isMobile, isTablet, isPanelOpen, panelPosition, togglePanel } = responsive;

  // Mobile: Bottom sheet layout
  if (isMobile) {
    return (
      <div className="responsive-layout h-full flex flex-col relative">
        {/* Map takes full screen on mobile */}
        <div className="flex-1 relative">
          {mapCanvas}

          {/* Floating toggle button */}
          <button
            onClick={togglePanel}
            className="absolute bottom-4 right-4 z-20 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-blue-700 transition-colors"
            aria-label={isPanelOpen ? 'Close AI Panel' : 'Open AI Panel'}
          >
            {isPanelOpen ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            )}
          </button>
        </div>

        {/* Bottom sheet AI panel */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl transform transition-transform duration-300 ease-out z-30 ${
            isPanelOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
          style={{ height: mobilePanelHeight, maxHeight: '80vh' }}
        >
          {/* Drag handle */}
          <div className="flex justify-center py-2">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
          </div>

          {/* Panel content */}
          <div className="h-full overflow-hidden pb-safe">
            {aiPanel}
          </div>
        </div>

        {/* Backdrop */}
        {isPanelOpen && (
          <div
            className="absolute inset-0 bg-black/20 z-20"
            onClick={togglePanel}
          />
        )}
      </div>
    );
  }

  // Tablet: Collapsible side panel
  if (isTablet) {
    return (
      <div className="responsive-layout h-full flex">
        {/* Collapsible AI panel */}
        <div
          className={`bg-white border-r border-gray-200 transition-all duration-300 overflow-hidden flex-shrink-0 ${
            isPanelOpen ? 'w-80' : 'w-0'
          }`}
        >
          <div className="w-80 h-full">
            {aiPanel}
          </div>
        </div>

        {/* Map canvas */}
        <div className="flex-1 relative">
          {mapCanvas}

          {/* Toggle button */}
          <button
            onClick={togglePanel}
            className="absolute top-4 left-4 z-10 p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 transition-colors"
            aria-label={isPanelOpen ? 'Close AI Panel' : 'Open AI Panel'}
          >
            {isPanelOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Desktop: Fixed side panel
  return (
    <div className="responsive-layout h-full flex">
      {/* Fixed AI panel */}
      <div
        className="bg-white border-r border-gray-200 flex-shrink-0 overflow-hidden"
        style={{ width: panelWidth }}
      >
        {aiPanel}
      </div>

      {/* Map canvas */}
      <div className="flex-1 relative">
        {mapCanvas}
      </div>
    </div>
  );
};

// ============================================================================
// Mobile-Optimized Input Component
// ============================================================================

export interface MobileInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  showVoiceButton?: boolean;
  onVoiceClick?: () => void;
}

export const MobileInput: React.FC<MobileInputProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Ask a question...',
  disabled = false,
  showVoiceButton = false,
  onVoiceClick,
}) => {
  const { isMobile } = useResponsive();

  return (
    <div className={`flex items-center gap-2 ${isMobile ? 'p-3' : 'p-4'}`}>
      <div className="flex-1 relative">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 ${
            isMobile ? 'px-4 py-3 text-base' : 'px-4 py-2 text-sm'
          }`}
        />
      </div>

      {showVoiceButton && (
        <button
          onClick={onVoiceClick}
          disabled={disabled}
          className={`flex-shrink-0 bg-gray-100 rounded-full hover:bg-gray-200 disabled:opacity-50 transition-colors ${
            isMobile ? 'p-3' : 'p-2'
          }`}
          aria-label="Voice input"
        >
          <svg className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>
      )}

      <button
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        className={`flex-shrink-0 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors ${
          isMobile ? 'p-3' : 'p-2'
        }`}
        aria-label="Send message"
      >
        <svg className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </button>
    </div>
  );
};

// ============================================================================
// Mobile Action Sheet
// ============================================================================

export interface ActionSheetOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
  destructive?: boolean;
  disabled?: boolean;
}

export interface MobileActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  options: ActionSheetOption[];
  onSelect: (optionId: string) => void;
}

export const MobileActionSheet: React.FC<MobileActionSheetProps> = ({
  isOpen,
  onClose,
  title,
  options,
  onSelect,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl animate-slide-up pb-safe">
        {/* Handle */}
        <div className="flex justify-center py-2">
          <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
        </div>

        {/* Title */}
        {title && (
          <div className="px-4 py-2 border-b border-gray-100">
            <h3 className="text-sm font-medium text-gray-500 text-center">{title}</h3>
          </div>
        )}

        {/* Options */}
        <div className="py-2">
          {options.map(option => (
            <button
              key={option.id}
              onClick={() => {
                onSelect(option.id);
                onClose();
              }}
              disabled={option.disabled}
              className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed ${
                option.destructive ? 'text-red-600' : 'text-gray-900'
              }`}
            >
              {option.icon && <span className="flex-shrink-0">{option.icon}</span>}
              <span className="text-base">{option.label}</span>
            </button>
          ))}
        </div>

        {/* Cancel button */}
        <div className="px-4 py-2 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full py-3 text-base font-medium text-blue-600 hover:bg-gray-50 rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Touch-Friendly Action Buttons
// ============================================================================

export interface TouchActionButtonProps {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  fullWidth?: boolean;
}

export const TouchActionButton: React.FC<TouchActionButtonProps> = ({
  label,
  icon,
  onClick,
  variant = 'secondary',
  size = 'md',
  disabled = false,
  fullWidth = false,
}) => {
  const { isMobile } = useResponsive();

  const sizeClasses = {
    sm: isMobile ? 'px-3 py-2 text-sm' : 'px-2 py-1 text-xs',
    md: isMobile ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm',
    lg: isMobile ? 'px-6 py-4 text-lg' : 'px-4 py-3 text-base',
  };

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300',
    ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${fullWidth ? 'w-full' : ''}
        rounded-lg font-medium flex items-center justify-center gap-2
        transition-colors disabled:opacity-50 disabled:cursor-not-allowed
        touch-manipulation
      `}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span>{label}</span>
    </button>
  );
};

// ============================================================================
// Exports
// ============================================================================

export default ResponsiveLayout;
