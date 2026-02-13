import React, { useEffect, useRef } from 'react';

interface PerformanceMonitorProps {
  componentName: string;
  enabled?: boolean;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  componentName,
  enabled = process.env.NODE_ENV === 'development'
}) => {
  const renderCount = useRef(0);
  const startTime = useRef<number>();

  useEffect(() => {
    if (!enabled) return;
    
    renderCount.current += 1;
    startTime.current = performance.now();
    
    console.log(`[PERF] ${componentName} render #${renderCount.current} started`);
    
    return () => {
      if (startTime.current) {
        const duration = performance.now() - startTime.current;
        console.log(`[PERF] ${componentName} render #${renderCount.current} completed in ${duration.toFixed(2)}ms`);
      }
    };
  });

  useEffect(() => {
    if (!enabled) return;
    
    const endTime = performance.now();
    if (startTime.current) {
      const totalTime = endTime - startTime.current;
      if (totalTime > 16) { // Flag renders taking longer than 16ms (60fps threshold)
        console.warn(`[PERF] ${componentName} slow render detected: ${totalTime.toFixed(2)}ms`);
      }
    }
  });

  return null;
};

export const useRenderCount = (componentName: string, enabled = process.env.NODE_ENV === 'development') => {
  const renderCount = useRef(0);
  
  useEffect(() => {
    if (!enabled) return;
    renderCount.current += 1;
    console.log(`[PERF] ${componentName} rendered ${renderCount.current} times`);
  });
  
  return renderCount.current;
};

export default PerformanceMonitor;