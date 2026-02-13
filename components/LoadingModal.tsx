import React, { useState, useEffect, useRef } from 'react';
import { useProjectStats, formatProjectFacts } from '@/hooks/useProjectStats';
import { ParticleEffectManager } from './particles/ParticleEffectManager';
import Image from 'next/image';
import { 
  BarChart3, 
  Car, 
  Brain, 
  Target, 
  Layers, 
  Zap,
  TrendingUp
} from 'lucide-react';

interface LoadingModalProps {
  progress: number;
  show: boolean;
}


interface LoadingFact {
  type: 'general' | 'project';
  text: string;
  icon?: React.ReactNode;
}

// General facts about housing market analysis capabilities
const GENERAL_FACTS: LoadingFact[] = [
  { type: 'general', text: 'Quebec\'s housing market spans from Montreal\'s urban core to rural regions', icon: <Target className="w-5 h-5" /> },
  { type: 'general', text: 'Forward Sortation Areas (FSAs) provide neighborhood-level market insights', icon: <BarChart3 className="w-5 h-5" /> },
  { type: 'general', text: 'Hot Growth Index identifies emerging high-potential neighborhoods', icon: <TrendingUp className="w-5 h-5" /> },
  { type: 'general', text: 'New Homeowner Index reveals first-time buyer opportunities', icon: <Layers className="w-5 h-5" /> },
  { type: 'general', text: 'Housing Affordability Index spots value investments across Quebec', icon: <Brain className="w-5 h-5" /> },
  { type: 'general', text: 'AI-powered analysis processes millions of data points instantly', icon: <Zap className="w-5 h-5" /> },
  { type: 'general', text: 'Tenure analysis compares ownership vs rental market dynamics', icon: <Car className="w-5 h-5" /> },
  { type: 'general', text: 'Strategic housing analysis combines demographics, income, and growth patterns', icon: <Brain className="w-5 h-5" /> },
  { type: 'general', text: 'Real estate market intelligence covering rural to metropolitan areas', icon: <Target className="w-5 h-5" /> },
];


export const LoadingModal: React.FC<LoadingModalProps> = ({ progress: externalProgress, show }) => {
  // Internal progress state to manage continuous loading even when tab is inactive
  const [internalProgress, setInternalProgress] = useState(externalProgress);
  const [currentFact, setCurrentFact] = useState<LoadingFact | null>(null);
  const [allFacts, setAllFacts] = useState<LoadingFact[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const factIntervalRef = useRef<NodeJS.Timeout>();
  
  // Fetch project stats
  const { stats: projectStats } = useProjectStats();
  
  console.log('[LoadingModal] Render:', { show, externalProgress, internalProgress });
  
  // Simplified useEffect to avoid loops - only update when external progress increases
  useEffect(() => {
    if (externalProgress > internalProgress) {
      setInternalProgress(externalProgress);
    }
  }, [externalProgress, internalProgress]); // Add internalProgress to dependencies
  
  
  // Load facts
  useEffect(() => {
    if (!show) return;
    
    const loadFacts = () => {
      const projectFacts: LoadingFact[] = projectStats 
        ? formatProjectFacts(projectStats).map(text => ({
            type: 'project' as const,
            text,
            icon: <TrendingUp className="w-5 h-5" />
          }))
        : [];
      
      const combinedFacts = [...GENERAL_FACTS, ...projectFacts];
      // Shuffle facts for variety
      const shuffled = combinedFacts.sort(() => Math.random() - 0.5);
      setAllFacts(shuffled);
      if (shuffled.length > 0) {
        setCurrentFact(shuffled[0]);
      }
    };
    loadFacts();
  }, [projectStats, show]);
  
  // Rotate facts - start after animation and progress are both active
  useEffect(() => {
    if (!show || allFacts.length === 0) return;

    // Wait 1 second to ensure animation has started and is visually active
    const initialDelay = setTimeout(() => {
      let currentIndex = 0;
      factIntervalRef.current = setInterval(() => {
        currentIndex = (currentIndex + 1) % allFacts.length;
        setCurrentFact(allFacts[currentIndex]);
      }, 3500); // Change fact every 3.5 seconds
    }, 1000); // 1 second delay to ensure animation is fully active

    return () => {
      clearTimeout(initialDelay);
      if (factIntervalRef.current) {
        clearInterval(factIntervalRef.current);
      }
    };
  }, [allFacts, show]);
  
  
  if (!show) {
    console.log('[LoadingModal] Not showing - returning null');
    return null;
  }
  
  console.log('[LoadingModal] Showing modal');
  
  const getLoadingMessage = () => {
    if (internalProgress < 30) return "Initializing map...";
    if (internalProgress < 60) return "Loading map layers...";
    if (internalProgress < 90) return "Preparing analysis tools...";
    if (internalProgress < 100) return "Finalizing setup...";
    return "Ready!";
  };

  return (
    <div className="fixed inset-0 bg-white dark:bg-gray-900 z-[99999] flex items-center justify-center pointer-events-auto">
      {/* Animation Canvas - DISABLED for debugging */}
      {/* <canvas 
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ opacity: 1.0 }}
      />
      <ParticleEffectManager 
        show={show}
        canvasRef={canvasRef}
      /> */}
      
      {/* Map pin logo with progress donut */}
      <div 
        className="absolute pointer-events-none"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 50
        }}
      >
        {/* Progress donut SVG */}
        <svg
          width="120"
          height="120"
          className="absolute"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          {/* Background circle (light grey) */}
          <circle
            cx="60"
            cy="60"
            r="50"
            stroke="#e0e0e0"
            strokeWidth="8"
            fill="none"
          />
          {/* Progress circle (green) */}
          <circle
            cx="60"
            cy="60"
            r="50"
            stroke="#33a852"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${internalProgress * 3.14159}, 314.159`}
            style={{
              transformOrigin: 'center',
              transform: 'rotate(-90deg)',
              transition: 'stroke-dasharray 0.3s ease'
            }}
          />
        </svg>
        
        {/* Logo in center */}
        <div className="relative flex items-center justify-center">
          <Image
            src="/mpiq_pin2.png"
            alt="Loading..."
            width={48}
            height={48}
            priority
            className="opacity-100"
          />
        </div>
      </div>
      
      {/* Text content positioned in lower half */}
      <div className="absolute bottom-0 left-0 right-0 pb-16">
        <div className="max-w-md w-full mx-auto p-6">
          {/* Loading message and progress */}
          <div className="space-y-4 text-center">
            <div>
              <h3 className="text-xs font-semibold text-foreground">
                {getLoadingMessage()}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {Math.round(internalProgress)}% complete
              </p>
            </div>
            
            {/* Facts display - HIDDEN as requested */}
            {false && currentFact && (
              <div className="animate-entrance">
                <div className="flex items-center justify-center space-x-2 text-xs text-muted-foreground">
                  <span className={`transition-all duration-500 ${
                    currentFact?.type === 'project' ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {currentFact?.icon}
                  </span>
                  <span className={`transition-all duration-500 ${
                    currentFact?.type === 'project' ? 'text-primary' : ''
                  }`}>
                    {currentFact?.text}
                  </span>
                </div>
              </div>
            )}
            
            {/* Loading dots */}
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '75ms' }} />
              <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};