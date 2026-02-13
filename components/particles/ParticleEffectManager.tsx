import React, { useState, useEffect, useRef } from 'react';
import { ColorTheme, GREEN_THEME } from './utils/ColorThemes';
import { NetworkBuildingEffect } from './effects/NetworkBuildingEffect';

export type EffectType = 'network' | 'logo' | 'globe' | 'wave';

export interface EffectConfig {
  type: EffectType;
  colorTheme: ColorTheme;
  initialized: boolean;
}

interface ParticleEffectManagerProps {
  show: boolean;
  canvasRef: { current: HTMLCanvasElement | null };
}

export const ParticleEffectManager: React.FC<ParticleEffectManagerProps> = React.memo(({
  show,
  canvasRef
}: ParticleEffectManagerProps) => {
  const [effectConfig, setEffectConfig] = useState<EffectConfig | null>(null);
  const initializationRef = useRef(false);
  const configLockRef = useRef(false); // Prevent multiple initializations

  // Initialize effect configuration on first show - only once per component lifecycle
  useEffect(() => {
    if (show && !effectConfig && !initializationRef.current && !configLockRef.current) {
      configLockRef.current = true; // Lock to prevent race conditions
      initializationRef.current = true;
      
      const type: EffectType = 'network'; // Use new network building effect
      const colorTheme = GREEN_THEME; // Force green theme for consistency
      
      console.log('[ParticleEffectManager] LOCKED - Using Network Building Effect with Green Theme:', { type, colorTheme: colorTheme.name });
      console.log('[ParticleEffectManager] Will render ONLY: Network Building Effect with Green colors');
      
      setEffectConfig({
        type,
        colorTheme,
        initialized: true
      });
    }
  }, [show]); // Remove effectConfig from dependencies to prevent loops

  // Don't reset effect config to prevent animation restarts
  // Remove cleanup entirely to prevent flashing

  // Don't render until we have a configuration
  if (!show || !effectConfig) {
    return null;
  }

  // Render network building effect only
  return (
    <NetworkBuildingEffect
      canvasRef={canvasRef}
      colorTheme={effectConfig.colorTheme}
      show={show}
    />
  );
});