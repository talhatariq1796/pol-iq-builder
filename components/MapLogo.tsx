// MapLogo.tsx
import React, { useState, useEffect } from 'react';
import Image from 'next/image';

type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

interface MapLogoProps {
  logoUrl?: string;
  position?: Position;
  style?: 'fade-out' | 'permanent' | 'hover-fade' | 'semi-transparent';
  initialDelay?: number;
  fadeOutDelay?: number;
  isLoading?: boolean;
  size?: 'normal' | 'large' | 'xlarge' | 'full';
  sidebarWidth?: number;
}

const MapLogo = ({ 
  logoUrl = "/mpiq_logo.png",
  position = 'center',
  style = 'fade-out',
  initialDelay = 1000,
  fadeOutDelay = 10000,
  isLoading = false,
  size = 'normal',
  sidebarWidth = 600
}: MapLogoProps) => {
  const [isVisible, setIsVisible] = useState(true);
  const [shouldRender, setShouldRender] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  const positionStyles: Record<Position, string> = {
    'top-left': 'top-4 left-68',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'center': 'top-1/2 transform-gpu'
  };

  useEffect(() => {
    if (isLoading) {
      setIsVisible(true);
      setShouldRender(true);
    }
  }, [isLoading]);

  useEffect(() => {
    if (style === 'fade-out' && !isLoading) {
      const fadeTimer = setTimeout(() => {
        setIsVisible(false);
      }, fadeOutDelay);

      // Remove from DOM after fade animation completes
      const removeTimer = setTimeout(() => {
        setShouldRender(false);
      }, fadeOutDelay + 500); // 500ms extra for fade animation

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(removeTimer);
      };
    }
  }, [style, fadeOutDelay, isLoading]);

  const getOpacity = () => {
    if (style === 'permanent') return 'opacity-100';
    if (style === 'fade-out') return isVisible ? 'opacity-100' : 'opacity-0';
    if (style === 'hover-fade') return isHovered ? 'opacity-100' : 'opacity-50';
    if (style === 'semi-transparent') return 'opacity-50';
    return 'opacity-100';
  };

  const getSizeClass = () => {
    switch (size) {
      case 'large': return 'max-w-[600px]';
      case 'xlarge': return 'max-w-[800px]';
      case 'full': return 'max-w-full';
      default: return 'max-w-[200px]';
    }
  };

  const getImageSize = () => {
    switch (size) {
      case 'large': return { width: 300, height: 150 };
      case 'xlarge': return { width: 400, height: 200 };
      case 'full': return { width: 600, height: 300 };
      default: return { width: 100, height: 50 };
    }
  };

  if (!shouldRender && style === 'fade-out') return null;

  const { width, height } = getImageSize();

  return (
    <div 
      className={`
        absolute z-50 transition-opacity duration-500 ease-in-out pointer-events-none
        ${positionStyles[position]}
        ${getOpacity()}
        ${isLoading ? 'animate-pulse' : ''}
      `}
      style={position === 'center' ? {
        left: `calc(50% - ${sidebarWidth/2}px)`,
        transform: 'translate(-50%, -50%)'
      } : undefined}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Image 
        src={logoUrl} 
        alt="MarketpulseIQ"
        className={`h-auto ${getSizeClass()}`}
        width={width}
        height={height}
      />
    </div>
  );
};

export default MapLogo;