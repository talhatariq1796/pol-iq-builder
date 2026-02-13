import React, { useRef, useEffect } from 'react';
import { ParticleEffectManager } from './ParticleEffectManager';

interface IsolatedParticleCanvasProps {
  show: boolean;
}

// Completely isolated particle canvas that never re-renders
export const IsolatedParticleCanvas = React.memo(({ show }: IsolatedParticleCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    console.log('[IsolatedParticleCanvas] Mounted ONCE - will never re-render');
    return () => {
      mountedRef.current = false;
      console.log('[IsolatedParticleCanvas] Unmounting');
    };
  }, []); // Empty deps - only run on mount/unmount

  return (
    <>
      <canvas 
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: 0.6 }}
      />
      <ParticleEffectManager 
        show={show}
        canvasRef={canvasRef}
      />
    </>
  );
}, (prevProps: IsolatedParticleCanvasProps, nextProps: IsolatedParticleCanvasProps) => {
  // Custom comparison - only re-render if show changes from false to true or vice versa
  // This prevents any other prop changes from causing re-renders
  return prevProps.show === nextProps.show;
});

IsolatedParticleCanvas.displayName = 'IsolatedParticleCanvas';