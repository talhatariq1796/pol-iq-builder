/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import React, { useRef, useState, useEffect, memo, useCallback } from 'react';
import { Bot, Loader2 } from 'lucide-react';
import Image from 'next/image';
// import ThemeSwitcher from '@/components/theme/ThemeSwitcher';

// Dynamic imports

export interface LayerState {
  layer: __esri.FeatureLayer | null;
  visible: boolean;
  loading: boolean;
  group: string;
  error?: string;
  filters: any[];
  queryResults?: {
    features: any[];
    fields: any[];
  };
  active: boolean;
  isVirtual?: boolean;
  sourceLayerId?: string;
  rendererField?: string;
  name: string;
}

interface ResizableSidebarProps {
  view: __esri.MapView | null;
  layerStates: { [key: string]: LayerState };
  chatInterface?: React.ReactNode;
  onWidthChange: (width: number) => void;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  onLayerStatesChange: (layerStates: { [key: string]: LayerState }) => void;
}

const ResizableSidebar = memo(({ 
  layerStates,
  chatInterface,
  defaultWidth}: ResizableSidebarProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeTab, setActiveTab] = useState('chat');

  // Track layer loading state
  useEffect(() => {
    if (!layerStates) return;

    const allLayers = Object.values(layerStates);
    const hasUnloadedLayers = allLayers.some(state => 
      state.layer && !state.layer.loaded
    );

    if (!hasUnloadedLayers && allLayers.length > 0) {
      // All layers are loaded
      setTimeout(() => {
        setIsLoading(false);
      }, 1000); // Match the delay in MapWidgets
    } else {
      setIsLoading(true);
    }
  }, [layerStates]);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Handler for openInfographics events: store detail and switch to infographics tab
  const handleOpenInfographics = useCallback(() => {
    console.log('[ResizableSidebar] ✅ handleOpenInfographics received event. ONLY switching tab.');

    // Switch tab if not already on infographics
    setActiveTab('infographics'); // Always set to infographics when event received
  }, []); // No dependencies needed since we always want to switch to infographics

  // Listen for openInfographics event to switch to infographics tab
  useEffect(() => {
    document.addEventListener('openInfographics', handleOpenInfographics as EventListener);

    return () => {
      document.removeEventListener('openInfographics', handleOpenInfographics as EventListener);
    };
  }, [handleOpenInfographics]); // Only depend on the stable callback

  if (!mounted) return null;

  return (
    <>
      <div 
        ref={containerRef}
        className="fixed right-0 top-0 bottom-0 theme-sidebar shadow-lg"
        style={{ 
          width: `${defaultWidth}px`, 
          zIndex: 10,
          backgroundColor: 'var(--theme-bg-secondary)',
          borderLeft: '1px solid var(--theme-border)',
          color: 'var(--theme-text-primary)'
        }}
      >
        <div className="h-full flex flex-col" style={{ borderLeft: '1px solid var(--theme-border)' }}>
          <div className="p-2" style={{ borderBottom: '1px solid var(--theme-border)' }}>
            <div className="flex items-center justify-between pl-4 p-4">
              <div className="flex items-center gap-2">
                <Image 
                  src="/mpiq_pin2.png" 
                  alt="IQ Logo" 
                  width={20} 
                  height={20}
                  priority
                />
                <div className="flex text-xl font-bold">
                  <span className="firefly-accent-primary">IQ</span>
                  <span className="-ml-px" style={{ color: 'var(--theme-text-primary)' }}>center</span>
                </div>
              </div>
{/* <ThemeSwitcher /> */}
            </div>
          </div>

          {/* Direct chat content without Tabs */}
          <div className="flex-1 overflow-hidden h-[calc(100vh-80px)]">
            {chatInterface ? (
                <div className="h-full">{chatInterface}</div>
              ) : (
                <ChatLoadingState />
            )}
          </div>
        </div>
      </div>
    </>
  );
});

// Update LoadingProgress to be simpler

// Update ChatLoadingState to use the same simple loading state
const ChatLoadingState: React.FC = () => {
  return (
    <div className="p-4">
      <div 
        className="theme-card rounded-lg p-4"
        style={{
          backgroundColor: 'var(--theme-bg-tertiary)',
          border: '1px solid var(--theme-border)'
        }}
      >
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 firefly-accent-primary" />
          <span className="text-xs" style={{ color: 'var(--theme-text-secondary)' }}>Initializing AI...</span>
          <Loader2 className="h-3 w-3 animate-spin firefly-accent-primary" />
        </div>
      </div>
    </div>
  );
};



export default ResizableSidebar;