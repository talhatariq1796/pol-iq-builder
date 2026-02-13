import React, { useEffect, useRef } from 'react';
import { ParticleEffectManager } from './ParticleEffectManager';

interface PersistentAnimationCanvasProps {
  show: boolean;
}

// Global canvas element that persists across component remounts
let globalCanvasElement: HTMLCanvasElement | null = null;
let globalCanvasContainer: HTMLDivElement | null = null;
let activeInstances = 0;

export const PersistentAnimationCanvas: React.FC<PersistentAnimationCanvasProps> = ({ show }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!show) return;

    activeInstances++;
    console.log('[PersistentAnimationCanvas] Starting, active instances:', activeInstances);

    // Create or reuse the global canvas
    if (!globalCanvasElement) {
      console.log('[PersistentAnimationCanvas] Creating new global canvas');
      const canvas = document.createElement('canvas');
      canvas.className = 'absolute inset-0 pointer-events-none';
      canvas.style.opacity = '0.7';
      globalCanvasElement = canvas;
    }

    // Create or reuse the global container
    if (!globalCanvasContainer) {
      console.log('[PersistentAnimationCanvas] Creating new global container');
      const container = document.createElement('div');
      container.className = 'fixed inset-0 pointer-events-none';
      container.style.zIndex = '99998'; // Below modal content but above everything else
      globalCanvasContainer = container;
      document.body.appendChild(container);
    }

    // Append canvas to container if not already there
    if (!globalCanvasContainer.contains(globalCanvasElement)) {
      globalCanvasContainer.appendChild(globalCanvasElement);
    }

    // Store references for the effect manager
    canvasRef.current = globalCanvasElement;

    return () => {
      activeInstances--;
      console.log('[PersistentAnimationCanvas] Stopping, active instances:', activeInstances);
      
      // Only cleanup when no more instances exist
      if (activeInstances <= 0) {
        console.log('[PersistentAnimationCanvas] Cleaning up global canvas');
        if (globalCanvasContainer && document.body.contains(globalCanvasContainer)) {
          document.body.removeChild(globalCanvasContainer);
        }
        globalCanvasElement = null;
        globalCanvasContainer = null;
        activeInstances = 0; // Reset counter
      }
    };
  }, [show]);

  // Note: Cleanup is handled by the show useEffect above

  // Only render the effect manager, not the canvas (since it's global)
  return show && canvasRef.current ? (
    <div ref={containerRef} style={{ display: 'none' }}>
      <ParticleEffectManager 
        show={show}
        canvasRef={canvasRef}
      />
    </div>
  ) : null;
};

// Cleanup function to be called when the app unmounts
export const cleanupGlobalCanvas = () => {
  if (globalCanvasContainer && document.body.contains(globalCanvasContainer)) {
    document.body.removeChild(globalCanvasContainer);
  }
  globalCanvasElement = null;
  globalCanvasContainer = null;
};