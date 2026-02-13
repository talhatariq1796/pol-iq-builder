/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useRef, useEffect, useCallback, ReactElement, memo, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { extractScoreValue } from '@/lib/analysis/utils/FieldMappingConfig';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import InfographicsTab from './tabs/InfographicsTab';
import {
  Loader2,
  BarChart,
  X,
  MessageCircle,
  UserCog,
  Target,
} from 'lucide-react';
import { useChatContext } from './chat-context-provider';
import { 
  ChatMessage, 
  GeoProcessingStep,
  DebugInfo,
  ChatVisualizationResult,
  GeospatialFeature,
  AnalysisResult as QueryAnalysisResult
} from '@/lib/analytics/types';
import { VisualizationFactory } from '@/utils/visualization-factory';
import { ANALYSIS_CATEGORIES } from './chat/chat-constants';
import { createHighlights } from './chat/map-highlight-manager';
import QueryDialog from './chat/QueryDialog';
import MessageList from './chat/MessageList';
import { CustomVisualizationPanel } from '@/components/Visualization/CustomVisualizationPanel';
import { layers } from '@/config/layers';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { personaMetadata } from '@/app/api/claude/prompts';
import ChatBar from '@/components/chat/ChatBar';
import { classifyQuery } from '@/lib/ai/query-classifier';
import { renderPerformanceMetrics } from '@/lib/utils/performanceMetrics';
import { resolveAreaName as resolveSharedAreaName } from '@/lib/shared/AreaName';

// Import Unified Workflow Components
import UnifiedAnalysisWorkflow from '@/components/unified-analysis/UnifiedAnalysisWorkflow';
import { UnifiedAnalysisResponse } from '@/components/unified-analysis/UnifiedAnalysisWrapper';

// AnalysisEngine Integration - Replace existing managers
import { useAnalysisEngine, AnalysisOptions, AnalysisResult, VisualizationResult, ProcessedAnalysisData } from '@/lib/analysis';

// Endpoint Selection Integration
import AnalysisEndpointSelector from '@/components/analysis/AnalysisEndpointSelector';
import { suggestAnalysisEndpoint } from '@/utils/endpoint-suggestion';

// Score Terminology System
import { generateScoreDescription, validateScoreTerminology, validateScoreExplanationPlacement, getScoreConfigForEndpoint } from '@/lib/analysis/utils/ScoreTerminology';

// Clustering Components
import { ClusterConfigPanel } from '@/components/clustering/ClusterConfigPanel';
import { ClusterConfig, DEFAULT_CLUSTER_CONFIG } from '@/lib/clustering/types';

// Brand icons (Simple Icons)
import {
  SiNike,
  SiAdidas,
  SiPuma,
  SiNewbalance,
  SiJordan,
  SiReebok
} from 'react-icons/si';
import { GiConverseShoe, GiRunningShoe } from 'react-icons/gi';
import { PiStrategy, PiLightning } from 'react-icons/pi';
import { GoLightBulb } from 'react-icons/go';
import { VscTools } from 'react-icons/vsc';
import { FaRegHandshake } from 'react-icons/fa';
import { SHAPChartModal } from './chart/SHAPChartModal';

// Load ArcGIS API
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Graphic from '@arcgis/core/Graphic';
import * as geometryEngine from '@arcgis/core/geometry/geometryEngine';

// Shared visualization utility
import { applyAnalysisEngineVisualization } from '@/utils/apply-analysis-visualization';

// Types for feature validation
type BaseGeometry = {
  type: string;
  spatialReference: { wkid: number };
  hasCoordinates?: boolean;
  hasRings?: boolean;
};

type PolygonGeometry = BaseGeometry & {
  type: 'Polygon';
  rings: number[][][];
  coordinates: number[][][];
  hasRings: boolean;
  hasCoordinates: boolean;
};

type PointGeometry = BaseGeometry & {
  type: 'Point';
  coordinates: number[];
  hasCoordinates: boolean;
};

type GeometryType = PolygonGeometry | PointGeometry;

type FeatureType = {
  type: 'Feature';
  geometry: GeometryType;
  properties: Record<string, any>;
};

// Types
type LocalChatMessage = ChatMessage & {
  role: 'user' | 'assistant' | 'system';
  metadata?: {
    analysisResult?: any;
    context?: string;
    totalFeatures?: number;
    visualizationResult?: ChatVisualizationResult;
    debugInfo?: DebugInfo;
    error?: string;
    isStreaming?: boolean;
  };
};

export interface LegendItem {
  id?: string;
  label: string;
  color: string;
  value?: string | number | boolean | null;
  type?: string;
}

interface EnhancedGeospatialChatProps {
  agentType: 'geospatial' | 'general' | 'trends';
  dataSource: {
    serviceUrl: string;
    layerId: string;
  };
  onFeaturesFound: (features: any[], isComposite?: boolean) => void;
  onError: (error: Error) => void;
  onVisualizationLayerCreated: (layer: __esri.FeatureLayer | null, shouldReplace?: boolean) => void;
  mapView: __esri.MapView | null;
  setFormattedLegendData: React.Dispatch<React.SetStateAction<any>>;
  setVisualizationResult: React.Dispatch<React.SetStateAction<ChatVisualizationResult | null>>;
  children?: React.ReactNode;
  mapViewRefValue?: __esri.MapView | null;
}



// Persona icons map (module-scope so it's visible throughout the file)
const PERSONA_ICON_MAP: Record<string, React.ComponentType<any>> = {
  strategist: PiStrategy,
  tactician: PiLightning,
  creative: GoLightBulb,
  'product-specialist': VscTools,
  'customer-advocate': FaRegHandshake,
};

// Frontend Analysis Function - Processes geographic features to generate analysis results

// Helper function to create analysis summary when Claude API fails
const createAnalysisSummary = (
  analysisResult: AnalysisResult,
  enhancedResult: any,
  featureCount: number,
  query: string,
  targetOptions: Array<{label: string, value: string}>,
  currentTargetValue: string
): string => {
  // CRITICAL: Use existing summary if it exists (e.g., from clustering)
  if (analysisResult.data?.summary && analysisResult.data.summary.trim().length > 0) {
    console.log('🎯 [createAnalysisSummary] Using existing summary from analysisResult.data.summary');
    console.log('🎯 [createAnalysisSummary] Summary preview:', analysisResult.data.summary.substring(0, 200) + '...');
    return `## Analysis Complete: ${query}\n\n${analysisResult.data.summary}`;
  }
  
  console.log('🎯 [createAnalysisSummary] No existing summary found, generating default template');
  const endpoint = analysisResult.endpoint;
  const dataPoints = analysisResult.data?.records?.length || 0;
  const targetField = targetOptions.find((opt: any) => opt.value === currentTargetValue)?.label || 'Performance';
  
  let summary = `## Analysis Complete: ${query}\n\n`;
  
  // Add analysis details
  summary += `**Analysis Type:** ${endpoint.replace('/', '').replace('-', ' ').toUpperCase()}\n`;
  summary += `**Data Points:** ${dataPoints.toLocaleString()} cached records analyzed\n`;
  summary += `**Geographic Features:** ${featureCount.toLocaleString()} areas visualized\n`;
  summary += `**Target Metric:** ${targetField}\n\n`;
  
  // Add key findings from enhanced result
  if (enhancedResult?.results?.length > 0) {
    // Determine the correct value field based on analysis type/target
    const valueField =
      analysisResult.data?.targetVariable ||
      (analysisResult.endpoint === '/strategic-analysis' ? 'strategic_analysis_score' : 'value');

    // Sort descending by the chosen value field to get true top markets
    const topResults = [...enhancedResult.results]
      .sort((a: any, b: any) =>
        (Number(b[valueField] ?? b.value ?? 0)) - (Number(a[valueField] ?? a.value ?? 0))
      )
      .slice(0, 5);
    summary += `**Top Performing Areas:**\n`;
    topResults.forEach((result: any, index: number) => {
  const value = Number(result[valueField] ?? result.value ?? result[currentTargetValue] ?? 0);
      summary += `${index + 1}. ${result.area_name || result.area_id || 'Area'}: ${value.toLocaleString()}\n`;
    });
    summary += `\n`;
  }
  
  // Add data source info
  summary += `**Data Sources:**\n`;
  summary += `• Frontend Cache: 3,983 comprehensive records with 102+ fields\n`;
  summary += `• Geographic Data: ArcGIS Feature Service\n`;
  summary += `• Analysis Engine: Cache-based processing (no microservice calls)\n\n`;
  
  // Add next steps
  summary += `**Visualization:** The map now shows the analysis results with interactive features. `;
  summary += `Click on any area to see detailed information and metrics.`;
  
  return summary;
};

// eslint-disable-next-line react/display-name
const EnhancedGeospatialChat = memo(({
  dataSource,
  onFeaturesFound,
  onVisualizationLayerCreated,
  mapView: initialMapView,
  setFormattedLegendData,
  setVisualizationResult,
  mapViewRefValue
}: EnhancedGeospatialChatProps): ReactElement => {
  // Load ArcGIS modules
  const [arcgisModules, setArcgisModules] = useState<any>(null);
  
  // Initialize ConfigurationManager for ranking system (singleton)
  
  useEffect(() => {
    setArcgisModules({ GraphicsLayer, Graphic, geometryEngine });
  }, []);

  // Listen for openInfographics event to open the infographics panel
  useEffect(() => {
    const handleOpenInfographics = () => {
      console.log('[GeospatialChat] openInfographics event received - opening panel');
      setIsInfographicsOpen(true);
    };

    document.addEventListener('openInfographics', handleOpenInfographics as EventListener);
    
    return () => {
      document.removeEventListener('openInfographics', handleOpenInfographics as EventListener);
    };
  }, []);

  console.log('[EnhancedGeospatialChat] Component props:', {
    hasInitialMapView: !!initialMapView,
    initialMapViewState: initialMapView ? {
      hasMap: !!initialMapView.map,
      layerCount: initialMapView.map?.layers?.length,
      isReady: initialMapView.ready
    } : null,
    hasMapViewRefValue: !!mapViewRefValue,
    mapViewRefValueState: mapViewRefValue ? {
      hasMap: !!mapViewRefValue.map,
      layerCount: mapViewRefValue.map?.layers?.length,
      isReady: mapViewRefValue.ready
    } : null
  });

  // Use the most up-to-date map view reference
  const currentMapView = mapViewRefValue || initialMapView;
  console.log('[EnhancedGeospatialChat] Current map view:', {
    hasCurrentMapView: !!currentMapView,
    currentMapViewState: currentMapView ? {
      hasMap: !!currentMapView.map,
      layerCount: currentMapView.map?.layers?.length,
      isReady: currentMapView.ready
    } : null
  });
  
  // Define debug logger outside of any function to make it accessible across the component
  
  // Cast onFeaturesFound to accept GeospatialFeature
  
  // Add chat context integration
  const { 
    addMessage: addContextMessage, 
    contextSummary, 
    refreshContextSummary
  } = useChatContext();
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const analyzeButtonRef = useRef<HTMLButtonElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activeView, setActiveView] = useState<'map' | 'scene'>('map');
  const currentVisualizationLayer = useRef<__esri.Layer | null>(null);
  // Feedback component removed as obsolete

  const [messages, setMessages] = useState<LocalChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [chatInputOpen, setChatInputOpen] = useState(false);
  const [trendsInput, setTrendsInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showUnifiedWorkflow, setShowUnifiedWorkflow] = useState(true);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [processingSteps, setProcessingSteps] = useState<GeoProcessingStep[]>([]);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [features, setFeatures] = useState<GeospatialFeature[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<LocalChatMessage | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [quickstartDialogOpen, setQuickstartDialogOpen] = useState(false);
  const [trendsDialogOpen, setTrendsDialogOpen] = useState(false);
  const [isPersonaDialogOpen, setIsPersonaDialogOpen] = useState(false);
  const [isInfographicsOpen, setIsInfographicsOpen] = useState(false);
  const [reportTemplate, setReportTemplate] = useState<string | null>(null);
  const [selectedGeometry, setSelectedGeometry] = useState<__esri.Geometry | null>(null);
  const { toast } = useToast();
  
  // State for reply dialog
  const [isReplyDialogOpen, setIsReplyDialogOpen] = useState(false);
  const [replyToMessageId, setReplyToMessageId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState('');
  
  // Minimum applications filter state
  const [minApplications, setMinApplications] = useState<number>(1);
  const [topNResults, setTopNResults] = useState(-1);
  const [isTopNAll, setIsTopNAll] = useState(true);
  const [isFiltersDialogOpen, setIsFiltersDialogOpen] = useState<boolean>(false);

  const [currentProcessingStep, setCurrentProcessingStep] = useState<string | null>(null);

  const [debugInfo, setDebugInfo] = useState<DebugInfo & { totalFeatures?: number }>({
    layerMatches: [],
    sqlQuery: "",
    features: [],
    timing: {},
    error: undefined
  });

  // NEW: Target variable selection
  const TARGET_OPTIONS = [
    { label: 'Nike', value: 'MP30034A_B' },
    { label: 'Adidas', value: 'MP30029A_B' },
    { label: 'Asics', value: 'MP30030A_B' },
    { label: 'Converse', value: 'MP30031A_B' },
    { label: 'Jordan', value: 'MP30032A_B' },
    { label: 'New Balance', value: 'MP30033A_B' },
    { label: 'Puma', value: 'MP30035A_B' },
    { label: 'Reebok', value: 'MP30036A_B' },
  ];

  // Brand icons (Simple Icons)
  const BRAND_ICON_MAP: Record<string, React.ComponentType<any>> = {
    Nike: SiNike,
    Adidas: SiAdidas,
    Asics: GiRunningShoe,
    Converse: GiConverseShoe,
    Jordan: SiJordan,
    'New Balance': SiNewbalance,
    Puma: SiPuma,
    Reebok: SiReebok,
  };

  // Add persona state management
  const [selectedPersona, setSelectedPersona] = useState<string>('strategist'); // Default to strategist

  // Re-add target selector dialog visibility
  const [isTargetDialogOpen, setIsTargetDialogOpen] = useState<boolean>(false);

  // Target variable selection (restored to original working pattern)
  const [selectedTargetVariable, setSelectedTargetVariable] = useState<string>('MP30034A_B'); // Default Nike

  // LOCAL STATE for target button - bypassing context for re-render issue
  const [currentTarget, setCurrentTarget] = useState<string>('MP30034A_B_P'); // Nike as default
  const [targetIcon, setTargetIcon] = useState<React.ComponentType<any>>(() => SiNike);
  // Track if user manually chose a target to prevent auto-reset by keyword detection
  const [manualTargetOverride, setManualTargetOverride] = useState<boolean>(false);

  // Add state for analysis result
  const [lastAnalysisResult, setLastAnalysisResult] = useState<QueryAnalysisResult | null>(null);
  const [lastAnalysisEndpoint, setLastAnalysisEndpoint] = useState<string | null>(null);
  
  // AnalysisEngine Integration - Replace the chaotic multi-manager system
  const analysisEngine = useAnalysisEngine();
  const { 
    executeAnalysis, 
    clearAnalysis  } = analysisEngine;

  // Sample size for analysis (restored to avoid breaking changes)
  const [sampleSizeValue, setSampleSizeValue] = useState<number>(5000);
  
  // Endpoint Selection State
  const [showEndpointSelector, setShowEndpointSelector] = useState<boolean>(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('auto');
  const [endpointSuggestions, setEndpointSuggestions] = useState<any[]>([]);

  // Debug selectedEndpoint and lastAnalysisEndpoint changes for clustering button state
  useEffect(() => {
    console.log('[ENDPOINT CHANGE] 🎯 Endpoint state changed:', {
      selectedEndpoint,
      lastAnalysisEndpoint,
      timestamp: new Date().toISOString()
    });

    // Reset endpoint-scoped UI state to prevent cross-endpoint contamination
    if (selectedEndpoint !== 'auto') {
      console.log('[ENDPOINT CHANGE] 🔄 Clearing endpoint-scoped state to avoid contamination');
      setProcessingSteps([]);
      setProcessingError(null);
      setError(null);
      setFeatures([]);
      setFormattedLegendData(null);
  setCachedDatasetSummary(null);
  setDatasetCacheTimestamp(null);
  setDatasetCacheKey(null);
      // Do not clear messages so conversation context remains
    }
    
    // Log what clustering button state would be
    const supportsClusteringEndpoints = ['/strategic-analysis', '/demographic-insights'];
    let clusteringSupported = true;
    let disabledReason = '';
    
    if (selectedEndpoint !== 'auto') {
      const selectedEndpointPath = `/${selectedEndpoint}`;
      clusteringSupported = supportsClusteringEndpoints.includes(selectedEndpointPath);
      if (!clusteringSupported) {
        disabledReason = `Clustering not supported for ${selectedEndpoint.replace('-', ' ')} analysis`;
      }
    } else if (lastAnalysisEndpoint) {
      clusteringSupported = supportsClusteringEndpoints.includes(lastAnalysisEndpoint);
      if (!clusteringSupported) {
        const endpointName = lastAnalysisEndpoint.replace('/', '').replace('-', ' ');
        disabledReason = `Clustering not supported for ${endpointName} analysis (last used)`;
      }
    }
    
    console.log('[ENDPOINT CHANGE] 🎯 Clustering button should be:', {
      clusteringSupported,
      disabledReason,
      buttonState: clusteringSupported ? 'ENABLED' : 'DISABLED',
      decisionPath: selectedEndpoint !== 'auto' ? 'MANUAL_SELECTION' : 
                   lastAnalysisEndpoint ? 'AUTO_WITH_HISTORY' : 'AUTO_NO_HISTORY'
    });
  }, [selectedEndpoint, lastAnalysisEndpoint]);
  
  // Cache comprehensive dataset summary for consistent follow-up chat
  const [cachedDatasetSummary, setCachedDatasetSummary] = useState<any>(null);
  const [datasetCacheTimestamp, setDatasetCacheTimestamp] = useState<string | null>(null);
  const [datasetCacheKey, setDatasetCacheKey] = useState<string | null>(null);

  // Debug: Monitor features state changes
  useEffect(() => {
    console.log('[DEBUG] Features state changed:', {
      count: features?.length || 0,
      timestamp: new Date().toISOString(),
      firstFeatureKeys: features?.[0] ? Object.keys(features[0]) : 'no features',
      hasCachedSummary: !!cachedDatasetSummary
    });
  }, [features, cachedDatasetSummary]);

  // Brand detection function
  const detectBrandsInQuery = (query: string): string[] => {
    if (!query) return [];
    
    const queryLower = query.toLowerCase();
    const detectedBrands: string[] = [];
    
    // Check for each brand in the query
    Object.entries({
      'nike': 'MP30034A_B',
      'jordan': 'MP30032A_B', 
      'converse': 'MP30031A_B',
      'adidas': 'MP30029A_B',
      'puma': 'MP30035A_B',
      'reebok': 'MP30036A_B',
      'new balance': 'MP30033A_B',
      'newbalance': 'MP30033A_B',
      'asics': 'MP30030A_B'
    }).forEach(([brandName, fieldCode]) => {
      if (queryLower.includes(brandName)) {
        detectedBrands.push(fieldCode);
      }
    });
    
    return detectedBrands;
  };

  // Get available target options based on analysis result OR real-time query detection


  // Update the real-time target update effect to use local state
  useEffect(() => {
    if (manualTargetOverride) return; // respect user choice

    const detectedBrands = detectBrandsInQuery(inputQuery);
    
    if (detectedBrands.length > 0) {
      // Set target to first detected brand
      const firstBrandField = detectedBrands[0];
      const targetOption = TARGET_OPTIONS.find(opt => opt.value === firstBrandField);
      
      if (targetOption && currentTarget !== firstBrandField) {
        setCurrentTarget(firstBrandField);
        const brandIcon = BRAND_ICON_MAP[targetOption.label] || SiNike;
        setTargetIcon(() => brandIcon);
        setManualTargetOverride(false);
      }
    } else {
      // If no brands are in the query, reset to default if not already there
      if (currentTarget !== 'MP30034A_B_P') {
        setCurrentTarget('MP30034A_B_P');
        setTargetIcon(() => SiNike);
        setManualTargetOverride(false);
      }
    }
  }, [inputQuery, currentTarget, manualTargetOverride]);

  // Update target when analysis result changes
  useEffect(() => {
    if (lastAnalysisResult?.targetVariable) {
      // Fix case sensitivity issue - search case-insensitively
      const targetOption = TARGET_OPTIONS.find(opt => 
        opt.value.toLowerCase() === lastAnalysisResult.targetVariable?.toLowerCase()
      );
      
      if (targetOption) {
        setCurrentTarget(targetOption.value);
        const brandIcon = BRAND_ICON_MAP[targetOption.label] || SiNike;
        setTargetIcon(() => brandIcon);
        setManualTargetOverride(false);
      }
    }
  }, [lastAnalysisResult, currentTarget, manualTargetOverride]);

  // Debug useEffect to monitor target button state changes
  useEffect(() => {
    console.log('[DEBUG] Target button state changed:', {
      currentTarget,
      targetIconName: targetIcon?.displayName || targetIcon?.name || 'Unknown',
      targetLabel: TARGET_OPTIONS.find(o => o.value === currentTarget)?.label,
      inputQuery: inputQuery.substring(0, 50),
      timestamp: new Date().toISOString()
    });
  }, [currentTarget, targetIcon, inputQuery]);

  // Visualization customization panel state (moved earlier so it is declared before use)
  const [isVizPanelOpen, setIsVizPanelOpen] = useState<boolean>(false);
  const [activeVizMessageId, setActiveVizMessageId] = useState<string | null>(null);
  const currentLayerConfigForViz = layers[dataSource.layerId];

  // React to feature changes
  useEffect(() => {
    console.log('[GeospatialChat] Features useEffect triggered:', {
      featuresIsArray: Array.isArray(features),
      featuresLength: features?.length,
      isProcessing,
      firstFeature: features?.[0] ? {
        type: features[0].type,
        hasProperties: !!features[0].properties,
        layerId: features[0].properties?.layerId
      } : null
    });
    
    // Only update message if processing is completely finished
    if (Array.isArray(features) && !isProcessing) {
      // Update the last message to include results
      setMessages((prevMessages: LocalChatMessage[]) => {
        // Find the last assistant message
        const lastAssistantMessageIndex = [...prevMessages]
          .reverse()
          .findIndex(msg => msg.role === 'assistant' || msg.role === 'system');
        
        if (lastAssistantMessageIndex >= 0) {
          const actualIndex = prevMessages.length - 1 - lastAssistantMessageIndex;
          const updatedMessages = [...prevMessages];
          const lastAssistantMessage = updatedMessages[actualIndex];
          
          // IMPORTANT: Only update if the message still has the generic "Processing your query..." content
          // Don't override detailed analysis results (like SHAP analysis)
          if (lastAssistantMessage.content === 'Processing your query...') {
            // Format information about the real data results
            const layerIds = [...new Set(features.map(f => f.properties?.layerId || 'unknown'))];
            const layerInfo = layerIds.length > 1 ? 
              `across ${layerIds.length} layers` : 
              layerIds[0] !== 'unknown' ? `from ${layerIds[0]}` : '';
            
            console.log('[GeospatialChat] Processing features for message update:', {
              featuresLength: features.length,
              layerIds,
              layerInfo
            });
            
            // Update the content with real result information
            let messageContent = "";
            
            if (features.length === 0) {
              messageContent = "Analysis complete. No results were found matching your query. Please try a different query or adjust your search criteria.";
            } else {
              messageContent = `Analysis complete. Found ${features.length} results ${layerInfo} matching your query.`;
            }
            
            updatedMessages[actualIndex] = {
              ...updatedMessages[actualIndex],
              content: messageContent,
              metadata: {
                ...updatedMessages[actualIndex].metadata,
                totalFeatures: features.length
              }
            };
          } else {
            console.log('[GeospatialChat] Skipping message update - detailed analysis already present:', {
              messageContent: lastAssistantMessage.content.substring(0, 100) + '...'
            });
          }
          
          return updatedMessages;
        }
        
        return prevMessages;
      });
    }
  }, [features, isProcessing]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      const adjustHeight = () => {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
      };

      textarea.addEventListener('input', adjustHeight);
      adjustHeight(); // Initial adjustment

      return () => textarea.removeEventListener('input', adjustHeight);
    }
  }, []);

  // Auto-scroll to new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup visualization layer on unmount
      if (currentVisualizationLayer.current && currentMapView && currentMapView.map) {
        console.log('[GeospatialChat] Cleaning up visualization layer on unmount');
        try {
          currentMapView.map.remove(currentVisualizationLayer.current);
          if (typeof (currentVisualizationLayer.current as any).destroy === 'function') {
            (currentVisualizationLayer.current as any).destroy();
          }
        } catch (error) {
          console.warn('[GeospatialChat] Error during cleanup:', error);
        }
      }
      currentVisualizationLayer.current = null;
    };
  }, [currentMapView]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newQuery = e.target.value;
    setInputQuery(newQuery);
    
    // Update endpoint suggestions based on query
    if (newQuery.length > 10) { // Only suggest for meaningful queries
      const suggestions = suggestAnalysisEndpoint(newQuery);
      if (suggestions.length > 0 && suggestions[0].confidence > 0.4) {
        // Map to endpoint names for display
        const suggestionInfo = suggestions.slice(0, 3).map(s => ({
          id: s.endpointId,
          name: getEndpointName(s.endpointId),
          confidence: s.confidence,
          reasoning: s.reasoning[0]
        }));
        setEndpointSuggestions(suggestionInfo);
      } else {
        setEndpointSuggestions([]);
      }
    } else {
      setEndpointSuggestions([]);
    }
  };

  // Helper function to get endpoint display name
  const getEndpointName = (endpointId: string): string => {
    const nameMap: Record<string, string> = {
      '/analyze': 'General Analysis',
      '/spatial-clusters': 'Geographic Clustering',
      '/competitive-analysis': 'Brand Competition',
      '/correlation-analysis': 'Correlation Analysis',
      '/demographic-insights': 'Demographic Analysis',
      '/market-risk': 'Risk Assessment',
      '/trend-analysis': 'Trend Analysis',
      '/penetration-optimization': 'Market Opportunities'
    };
    return nameMap[endpointId] || 'Analysis';
  };

  const handleMessageClick = (message: LocalChatMessage) => {
    setSelectedMessage(message);
    setDialogOpen(true);
  };

  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Text copied to clipboard",
        duration: 2000,
      });
    } catch (err) {
      console.error('Failed to copy text: ', err);
      toast({
        title: "Copy failed",
        description: "Failed to copy text to clipboard",
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  // Enhanced Score Export Helper Functions
  const createEnhancedScoreCSV = (analysisData: any): string => {
    if (!analysisData.records || analysisData.records.length === 0) {
      throw new Error('No records found in analysis data');
    }

    const targetVariable = analysisData.targetVariable || 'value';
    const analysisType = analysisData.type || 'analysis';
    
    // Define readable column headers based on analysis type
    const getReadableHeaders = (type: string, targetVar: string) => {
      const baseHeaders = ['Area Name', 'Area ID', 'Score', 'Rank'];
      
      // Add analysis-specific readable name for score column
      const scoreNames: Record<string, string> = {
        'strategic_analysis': 'Strategic Value Score',
        'competitive_analysis': 'Competitive Advantage Score', 
        'market_sizing': 'Market Size Score',
        'brand_analysis': 'Brand Analysis Score',
        'demographic_insights': 'Demographic Opportunity Score',
        'trend_analysis': 'Trend Strength Score',
        'correlation_analysis': 'Correlation Strength Score',
        'risk_analysis': 'Risk Adjusted Score',
        'real_estate_analysis': 'Real Estate Analysis Score'
      };
      
      baseHeaders[2] = scoreNames[type] || `${targetVar.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
      return baseHeaders;
    };

    // Create CSV headers
    const headers = getReadableHeaders(analysisType, targetVariable);
    
    // Create CSV rows with Enhanced Score Export data
    const csvRows = analysisData.records.map((record: any) => {
      const areaName = `"${(record.area_name || record.area_id || 'Unknown').replace(/"/g, '""')}"`;
      const areaId = record.area_id || record.id || '';
      const score = record[targetVariable] || record.value || 0;
      const rank = record.rank || '';
      
      // Create key demographics summary for context
      const props = record.properties || {};
      const demographics = [];
      
      if (props.total_population || props.population) {
        const pop = props.total_population || props.population;
        demographics.push(`Pop: ${Math.round(pop / 1000)}K`);
      }
      
      if (props.median_income || props.income) {
        const income = props.median_income || props.income;
        demographics.push(`Income: $${Math.round(income / 1000)}K`);
      }
      
      if (props.market_gap !== undefined) {
        demographics.push(`Gap: ${Math.round(props.market_gap)}%`);
      }
      
      const keyDemographics = `"${demographics.join(', ')}"`;
      
      return [areaName, areaId, score.toFixed(2), rank, keyDemographics].join(',');
    });
    
    // Add key demographics column to headers
    const finalHeaders = [...headers, 'Key Demographics'].join(',');
    
    return [finalHeaders, ...csvRows].join('\n');
  };

  const downloadCSV = (csvData: string, filename: string) => {
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleExportData = async (messageId: string) => {
    try {
      // Find the message with visualization data
      const message = messages.find(m => m.id === messageId);
      if (!message?.metadata?.analysisResult?.data) {
        toast({
          title: "Export failed",
          description: "No analysis data found to export",
          variant: "destructive",
        });
        return;
      }

      const analysisData = message.metadata.analysisResult.data;
      const analysisType = analysisData.type || 'analysis';
      
      // Create Enhanced Score Export CSV
      const csvData = createEnhancedScoreCSV(analysisData);
      
      // Generate filename with timestamp and analysis type
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `${analysisType.replace(/_/g, '-')}-export-${timestamp}.csv`;
      
      // Download CSV file
      downloadCSV(csvData, filename);
      
      toast({
        title: "Export successful",
        description: `Analysis data exported to ${filename}`,
        duration: 3000,
      });
      
    } catch (err) {
      console.error('Failed to export data:', err);
      toast({
        title: "Export failed", 
        description: "Failed to export analysis data",
        variant: "destructive",
      });
    }
  };

  const handleInfographicsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[GeospatialChat] handleInfographicsClick called');
    setIsInfographicsOpen(true);
  };

  // Extract SHAP values from analysis data and create chart data
  const extractSHAPValues = (analysisData: any): Array<{name: string, value: number}> => {
    try {
      const analysisType = analysisData.type || analysisData.analysis_type;
      console.log('[SHAP Extract] Processing analysis type:', analysisType);

      // For strategic-analysis, use the component weights as feature importance
      if (analysisType === 'strategic_analysis') {
        console.log('[SHAP Extract] Strategic analysis detected - using component weights');
        console.log('[SHAP Extract] Full data structure keys:', Object.keys(analysisData));
        console.log('[SHAP Extract] Methodology:', analysisData.methodology);
        
        if (analysisData.methodology?.component_weights) {
          const weights = analysisData.methodology.component_weights;
          console.log('[SHAP Extract] Component weights found:', weights);
          return Object.entries(weights).map(([key, value]: [string, any]) => ({
            name: key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
            value: typeof value === 'number' ? value * 100 : 0 // Convert to percentage
          }))
          .sort((a, b) => b.value - a.value)
          .filter(item => item.value > 0);
        } else {
          console.log('[SHAP Extract] No component weights found, creating fallback data');
          // For strategic analysis without methodology, create a fallback based on the scoring components
          return [
            { name: 'Demographic Opportunity Score', value: 21 },
            { name: 'Competitive Advantage Score', value: 20 },
            { name: 'Correlation Strength', value: 15 },
            { name: 'Market Gap Potential', value: 14 },
            { name: 'Brand Positioning', value: 10 },
            { name: 'Population Scale', value: 9 },
            { name: 'Economic Scale', value: 6 },
            { name: 'Cluster Consistency', value: 5 }
          ];
        }
      }

      // Check if there's already a featureImportance array
      if (analysisData.featureImportance && analysisData.featureImportance.length > 0) {
        console.log('[SHAP Extract] Using existing featureImportance data:', analysisData.featureImportance);
        return analysisData.featureImportance
          .map((item: any) => ({
            name: item.feature || item.name,
            value: item.shap_mean_abs || item.importance || item.value
          }))
          .sort((a: any, b: any) => b.value - a.value)
          .slice(0, 10)
          .filter((item: any) => item.value > 0);
      }

      // For other endpoints, extract from records with shap_ fields
      const records = analysisData.records || analysisData.results || analysisData.features || [];
      if (records.length === 0) {
        console.log('[SHAP Extract] No records, results, or features found');
        return [];
      }

      console.log('[SHAP Extract] Processing', records.length, 'records for SHAP values');

      // Aggregate SHAP values across all records
      const shapAggregation: Record<string, number[]> = {};
      
      records.forEach((record: any, index: number) => {
        // Handle both feature.properties structure and direct record structure
        const properties = record.properties || record;
        
        // Find all SHAP fields (fields starting with 'shap_')
        Object.keys(properties).forEach(key => {
          if (key.startsWith('shap_') && typeof properties[key] === 'number') {
            // Clean field name (remove 'shap_' prefix and make readable)
            const fieldName = key.replace('shap_', '').replace(/_/g, ' ');
            const readableName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
            
            if (!shapAggregation[readableName]) {
              shapAggregation[readableName] = [];
            }
            shapAggregation[readableName].push(Math.abs(properties[key])); // Use absolute value for importance
          }
        });

        // Log SHAP fields found in first few records for debugging
        if (index < 3) {
          const shapFields = Object.keys(properties).filter(k => k.startsWith('shap_'));
          console.log(`[SHAP Extract] Record ${index} SHAP fields:`, shapFields);
        }
      });

      console.log('[SHAP Extract] Aggregated SHAP fields:', Object.keys(shapAggregation));

      // Calculate average importance for each field
      const shapValues = Object.entries(shapAggregation).map(([name, values]) => ({
        name,
        value: values.reduce((sum, val) => sum + val, 0) / values.length
      }));

      // Sort by importance (descending) and take top 10
      return shapValues
        .sort((a, b) => b.value - a.value)
        .slice(0, 10)
        .filter(item => item.value > 0); // Only include non-zero values

    } catch (error) {
      console.error('[SHAP Extract] Error extracting SHAP values:', error);
      return [];
    }
  };

  const handleSHAPChart = async (messageId: string) => {
    try {
      // Find the message with analysis data
      const message = messages.find(m => m.id === messageId);
      if (!message?.metadata?.analysisResult?.data) {
        toast({
          title: "Chart creation failed",
          description: "No analysis data found to create chart",
          variant: "destructive",
        });
        return;
      }

      const analysisData = message.metadata.analysisResult.data;
      console.log('[SHAP Chart] Creating feature importance chart for:', analysisData.type);
      console.log('[SHAP Chart] Full analysis data structure:', analysisData);
      console.log('[SHAP Chart] Features array:', analysisData.features);
      
      if (analysisData.features && analysisData.features.length > 0) {
        console.log('[SHAP Chart] Sample feature properties:', analysisData.features[0]?.properties);
        console.log('[SHAP Chart] SHAP fields in first feature:', Object.keys(analysisData.features[0]?.properties || {}).filter(k => k.startsWith('shap_')));
      }
      
      // Extract SHAP values from the analysis data
      const shapData = extractSHAPValues(analysisData);
      
      if (!shapData || shapData.length === 0) {
        toast({
          title: "Chart creation failed", 
          description: "No feature importance data found in this analysis",
          variant: "destructive",
        });
        return;
      }

      // Open chart modal with shapData
      setSHAPChartData(shapData);
      setSHAPAnalysisType(analysisData.type || 'analysis');
      setSHAPChartOpen(true);
      
      console.log('[SHAP Chart] Generated chart data:', shapData);

    } catch (error) {
      console.error('[SHAP Chart] Error creating chart:', error);
      toast({
        title: "Chart creation failed",
        description: "An error occurred while creating the chart",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    console.log('[QueryManager] User requested to cancel current analysis');
    setCancelRequested(true);
    setIsProcessing(false);
    setCurrentProcessingStep(null);
    
    // Clear analysis state
    clearAnalysis();
    
    toast({
      title: "Analysis Cancelled",
      description: "The current analysis has been stopped.",
      variant: "default",
      duration: 2000,
    });
  };

  const handleClear = () => {
    // Clear UI state
    setMessages([]);
    setInputQuery('');
    setProcessingSteps([]);
    setProcessingError(null);
    setError(null);
    setFeatures([]);
    setCancelRequested(false);

    // Clear visualization layer from map
    if (currentMapView) {
      const highlightLayer = currentMapView.map.layers.find(
        (layer) => layer.title === "Highlighted FSAs"
      );
      if (highlightLayer && currentMapView && currentMapView.map) {
        try {
          currentMapView.map.remove(highlightLayer);
        } catch (error) {
          console.warn('[GeospatialChat] Error removing highlight layer:', error);
        }
      }

      if (currentVisualizationLayer.current && currentMapView && currentMapView.map) {
        try {
          currentMapView.map.remove(currentVisualizationLayer.current);
        } catch (error) {
          console.warn('[GeospatialChat] Error removing visualization layer:', error);
        }
        currentVisualizationLayer.current = null;
      }

      currentMapView.graphics.removeAll();
    }

    // Clear visualization result
    // setVisualizationResult(null); // Keep previous visualization for slider
    setFormattedLegendData(null);
    
    // Notify parent component
    onVisualizationLayerCreated(null, false);

    // Reset target to default (Nike)
    setSelectedTargetVariable('MP30034A_B');
    setCurrentTarget('MP30034A_B');
    setTargetIcon(() => SiNike);
    setManualTargetOverride(false);
  };

  // Add boundary caching state at component level
  const [cachedBoundaryFeatures, setCachedBoundaryFeatures] = useState<FeatureType[] | null>(null);
  const [boundaryLoadingPromise, setBoundaryLoadingPromise] = useState<Promise<FeatureType[]> | null>(null);

  // Add this function after the debug logger definition
  const loadGeographicFeatures: () => Promise<(FeatureType | null)[]> = async () => {
    try {
      // Return cached features if already loaded
      if (cachedBoundaryFeatures && cachedBoundaryFeatures.length > 0) {
        console.log('[loadGeographicFeatures] ✅ Using cached boundary features:', cachedBoundaryFeatures.length);
        return cachedBoundaryFeatures;
      }

      // If already loading, return the existing promise
      if (boundaryLoadingPromise) {
        console.log('[loadGeographicFeatures] ⏳ Waiting for existing boundary loading...');
        return boundaryLoadingPromise;
      }

      console.log('[loadGeographicFeatures] 📥 Loading ZIP Code boundaries for first time...');
      
             // Create and store the loading promise
       const loadingPromise = loadBoundariesFromFile();
       setBoundaryLoadingPromise(loadingPromise);

      try {
        const features = await loadingPromise;
        
        // Validate loaded features
        if (!features || features.length === 0) {
          console.error('[loadGeographicFeatures] ❌ No boundary features loaded from file');
          throw new Error('No boundary features loaded from file');
        }
        
        // Validate feature structure
        const validFeatures = features.filter(f => f && f.properties && f.geometry);
        if (validFeatures.length === 0) {
          console.error('[loadGeographicFeatures] ❌ No valid boundary features with properties and geometry');
          throw new Error('No valid boundary features found');
        }
        
        console.log('[loadGeographicFeatures] 🔍 Feature validation:', {
          totalLoaded: features.length,
          validFeatures: validFeatures.length,
          invalidFeatures: features.length - validFeatures.length,
          sampleFeature: validFeatures[0] ? {
            hasProperties: !!validFeatures[0].properties,
            propertyKeys: Object.keys(validFeatures[0].properties || {}),
            sampleId: validFeatures[0].properties?.ID,
            hasGeometry: !!validFeatures[0].geometry,
            geometryType: validFeatures[0].geometry?.type
          } : null
        });
        
        // Cache the loaded features
        setCachedBoundaryFeatures(validFeatures);
        setBoundaryLoadingPromise(null);
        
        console.log('[loadGeographicFeatures] ✅ Boundary features cached for session:', validFeatures.length);
        return validFeatures;
        
      } catch (error) {
        setBoundaryLoadingPromise(null);
        throw error;
      }
      
    } catch (error) {
      console.error('[loadGeographicFeatures] ❌ ERROR LOADING CACHED BOUNDARIES:', error);
      
      // CRITICAL: No fallbacks - we need actual ZIP Code boundaries
      throw new Error(`Cannot load ZIP Code boundaries: ${error}. Cached boundaries are required for geographic visualization.`);
    }
  };

  // Separate function for actual file loading
  const loadBoundariesFromFile = async (): Promise<FeatureType[]> => {
    // Load ZIP Code polygon boundaries from blob storage with fallback to local
    const { loadBoundaryData } = await import('@/utils/blob-data-loader');
    const boundaryData = await loadBoundaryData('fsa_boundaries');
    
    if (!boundaryData) {
      throw new Error('Failed to load ZIP code boundaries from both blob storage and local files');
    }
    
    console.log('[loadBoundariesFromFile] Boundaries data loaded:', {
      hasFeatures: !!(boundaryData as any).features,
      isArray: Array.isArray((boundaryData as any).features),
      count: (boundaryData as any).features?.length || 0,
      sampleFeature: (boundaryData as any).features?.[0] ? {
        hasProperties: !!(boundaryData as any).features[0].properties,
        hasGeometry: !!(boundaryData as any).features[0].geometry,
        sampleId: (boundaryData as any).features[0].properties?.ID
      } : null,
      source: 'blob-data-loader'
    });
    
    if (!(boundaryData as any).features || !Array.isArray((boundaryData as any).features)) {
      throw new Error('Invalid boundaries data structure - no features array');
    }
    
    if ((boundaryData as any).features.length === 0) {
      throw new Error('No features in boundaries data');
    }
    
    console.log('[loadBoundariesFromFile] 📁 ZIP Code boundaries loaded from file:', {
      total: (boundaryData as any).features.length,
      fileSize: `${((boundaryData as any).features.length * 0.0007).toFixed(1)} MB (estimated)`,
      source: 'blob-data-loader'
    });
    
    // Convert GeoJSON features to internal FeatureType format
    const features: FeatureType[] = (boundaryData as any).features.map((feature: any, index: number) => {
      if (!feature.geometry || !feature.properties) {
        console.warn(`[loadBoundariesFromFile] Invalid feature at index ${index}:`, feature);
        return null;
      }
      
      return {
        type: 'Feature',
        geometry: {
          type: feature.geometry.type,
          coordinates: feature.geometry.coordinates,
          spatialReference: { wkid: 4326 },
          hasCoordinates: true,
          hasRings: feature.geometry.type === 'Polygon'
        } as PolygonGeometry,
        properties: feature.properties
      };
    }).filter((f: FeatureType | null): f is FeatureType => f !== null);
    
    console.log('[loadBoundariesFromFile] ✅ Converted to internal format:', {
      totalFeatures: features.length,
      validFeatures: features.filter(f => f.geometry && f.properties).length,
      sampleFeature: features[0] ? {
        hasGeometry: !!features[0].geometry,
        geometryType: features[0].geometry?.type,
        hasProperties: !!features[0].properties,
        sampleId: features[0].properties?.ID
      } : null
    });
    
    return features;
  };

  // Update the geometry validation function

  const handleCustomizeVisualization = (messageId: string) => {
    setActiveVizMessageId(messageId);
    setIsVizPanelOpen(true);
  };

  // Function to zoom to a specific feature by ID
  // Debug function for testing ZIP code search - available in browser console as window.debugZipSearch
  const debugZipSearch = useCallback((testZipCode: string) => {
    console.log(`🔍 [DEBUG] Testing ZIP code search for: ${testZipCode}`);
    
    const normalizeId = (id: string): string => {
      if (!id) return '';
      if (/^\d{5}/.test(id)) {
        return id.substring(0, 5).toUpperCase();
      }
      return id.toString().toUpperCase().trim();
    };
    
    const targetId = normalizeId(testZipCode);
    console.log(`🔍 [DEBUG] Normalized target: ${targetId}`);
    
    const matches = features.filter((feature: GeospatialFeature) => {
      let featureIdValue = feature.properties?.FSA_ID || 
                       feature.properties?.ID || 
                       feature.properties?.OBJECTID ||
                       feature.properties?.id ||
                       feature.properties?.area_id ||
                       feature.properties?.zip_code ||
                       feature.properties?.ZIPCODE ||
                       feature.properties?.ZIP;
      
      if (!featureIdValue && feature.area_name) {
        const zipMatch = feature.area_name.match(/^\d{5}/);
        if (zipMatch) {
          featureIdValue = zipMatch[0];
        }
      }
      
      if (!featureIdValue && feature.area_name) {
        featureIdValue = feature.area_name;
      }
      
      if (!featureIdValue) return false;
      
      const normalizedFeatureId = normalizeId(featureIdValue.toString());
      return normalizedFeatureId === targetId;
    });
    
    console.log(`🔍 [DEBUG] Found ${matches.length} matches:`, matches.map(m => ({
      area_name: m.area_name,
      cluster_id: m.cluster_id,
      hasGeometry: !!m.geometry,
      properties: m.properties
    })));
    
    // Sample some features that might be close
    const sampleFeatures = features.slice(0, 20).map(f => {
      let extractedId = null;
      if (f.area_name) {
        const zipMatch = f.area_name.match(/^\d{5}/);
        if (zipMatch) extractedId = zipMatch[0];
      }
      return {
        area_name: f.area_name,
        extractedId,
        normalized: extractedId ? normalizeId(extractedId) : null
      };
    });
    
    console.log(`🔍 [DEBUG] Sample of available data:`, sampleFeatures);
    
    return matches;
  }, [features]);

  // Make debug function available globally
  useEffect(() => {
    (window as any).debugZipSearch = debugZipSearch;
    return () => {
      delete (window as any).debugZipSearch;
    };
  }, [debugZipSearch]);

  const handleZoomToFeature = useCallback(async (featureId: string) => {
    if (!currentMapView || !features.length) {
      console.warn('[ZoomToFeature] Map view or features not available');
      toast({
        title: "Zoom Failed",
        description: "Map or feature data not available",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    try {
      // Normalize the feature ID for comparison
      const normalizeId = (id: string): string => {
        if (!id) return '';
        // For Canadian FSA codes (letter-digit-letter pattern like J9Z)
        if (/^[A-Z]\d[A-Z]$/i.test(id)) {
          return id.toUpperCase().trim();
        }
        // For ZIP codes, take first 5 characters and uppercase
        if (/^\d{5}/.test(id)) {
          return id.substring(0, 5).toUpperCase();
        }
        // For other IDs, just uppercase and trim
        return id.toString().toUpperCase().trim();
      };

      const targetId = normalizeId(featureId);
      console.log('[ZoomToFeature] Looking for feature:', { originalId: featureId, normalizedId: targetId });
      
      // Debug: What type of data are we working with?
      console.log('[ZoomToFeature] Data analysis:', {
        totalFeatures: features.length,
        isClustered: features.some(f => f.cluster_id !== undefined),
        hasAreaNames: features.some(f => f.area_name !== undefined),
        dataTypes: features.slice(0, 3).map(f => ({
          hasProperties: !!f.properties,
          hasAreaName: !!f.area_name,
          hasClusterId: f.cluster_id !== undefined,
          areaNameSample: f.area_name,
          propertiesKeys: Object.keys(f.properties || {}).slice(0, 5)
        }))
      });

      // Find the feature in our current features array
      const targetFeature = features.find((feature: GeospatialFeature) => {
        // Try multiple possible ID fields for different data sources
        let featureIdValue = feature.properties?.FSA_ID || 
                         feature.properties?.ID || 
                         feature.properties?.OBJECTID ||
                         feature.properties?.id ||
                         feature.properties?.area_id ||
                         feature.properties?.zip_code ||
                         feature.properties?.ZIPCODE ||
                         feature.properties?.ZIP;
        
        // For clustered data, extract ZIP/FSA from area_name like "08701 (Lakewood)" or "J9Z (La Sarre)"
        if (!featureIdValue && feature.area_name) {
          // Try FSA pattern first (letter-digit-letter)
          const fsaMatch = feature.area_name.match(/^[A-Z]\d[A-Z]/i);
          if (fsaMatch) {
            featureIdValue = fsaMatch[0];
          } else {
            // Try ZIP pattern (5 digits)
            const zipMatch = feature.area_name.match(/^\d{5}/);
            if (zipMatch) {
              featureIdValue = zipMatch[0];
            }
          }
        }
        
        // Also try area_name directly for non-clustered cases
        if (!featureIdValue && feature.area_name) {
          featureIdValue = feature.area_name;
        }
        
        if (!featureIdValue) return false;
        
        const normalizedFeatureId = normalizeId(featureIdValue.toString());
        const match = normalizedFeatureId === targetId;
        
        // Debug the first few comparisons and any matches
        if (features.indexOf(feature) < 3 || match) {
          console.log('[ZoomToFeature] Comparing:', {
            featureIndex: features.indexOf(feature),
            area_name: feature.area_name,
            featureId: featureIdValue,
            normalized: normalizedFeatureId,
            targetId,
            match,
            hasGeometry: !!feature.geometry
          });
        }
        
        return match;
      });

      if (!targetFeature) {
        console.warn('[ZoomToFeature] Feature not found:', { 
          targetId, 
          totalFeatures: features.length,
          first10Features: features.slice(0, 10).map(f => ({
            FSA_ID: f.properties?.FSA_ID,
            ID: f.properties?.ID,
            OBJECTID: f.properties?.OBJECTID,
            area_id: f.properties?.area_id,
            zip_code: f.properties?.zip_code,
            ZIPCODE: f.properties?.ZIPCODE,
            area_name: f.area_name, // Show area_name for clustered data
            cluster_id: f.cluster_id, // Show cluster_id for clustered data
            allProperties: Object.keys(f.properties || {})
          }))
        });
        
        toast({
          title: "Feature Not Found",
          description: `Could not find feature with ID: ${featureId}`,
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

      console.log('[ZoomToFeature] Found feature:', {
        id: targetFeature.properties?.FSA_ID || targetFeature.properties?.ID || targetFeature.properties?.area_id || targetFeature.properties?.zip_code,
        hasGeometry: !!targetFeature.geometry,
        geometryType: targetFeature.geometry?.type
      });

      // Use a simpler approach - create a graphic and zoom to it
      if (targetFeature.geometry) {
        const coords = (targetFeature.geometry as any).rings || (targetFeature.geometry as any).coordinates;
        
        if (coords && coords.length > 0) {
          // For polygons, calculate center point and zoom there
          const geomType = (targetFeature.geometry.type || '').toString().toLowerCase();
          if (geomType === 'polygon') {
            const rings = coords[0]; // First ring
            if (rings && rings.length > 0) {
              // Calculate centroid
              let sumX = 0, sumY = 0;
              rings.forEach((coord: number[]) => {
                sumX += coord[0];
                sumY += coord[1];
              });
              const centerX = sumX / rings.length;
              const centerY = sumY / rings.length;
              
              console.log('[ZoomToFeature] Calculated center:', { centerX, centerY });
              
              // Zoom to center point
              await currentMapView.goTo({
                center: [centerX, centerY],
                zoom: 11
              }, {
                duration: 1000,
                easing: 'ease-out'
              });
              
              // Show success message
              toast({
                title: "Zoomed to Feature",
                description: `Centered map on ${featureId}`,
                duration: 2000,
              });
              
              console.log('[ZoomToFeature] Successfully zoomed to feature:', featureId);
              return;
            }
          } else if (geomType === 'point') {
            const [x, y] = coords;
            
            console.log('[ZoomToFeature] Point coordinates:', { x, y });
            
            // Zoom to point
            await currentMapView.goTo({
              center: [x, y],
              zoom: 12
            }, {
              duration: 1000,
              easing: 'ease-out'
            });
            
            // Show success message
            toast({
              title: "Zoomed to Feature",
              description: `Centered map on ${featureId}`,
              duration: 2000,
            });
            
            console.log('[ZoomToFeature] Successfully zoomed to feature:', featureId);
            return;
          }
        }
      }

      // If we get here, geometry processing failed
      console.warn('[ZoomToFeature] Could not process geometry for feature');
      toast({
        title: "Zoom Failed",
        description: "Feature geometry could not be processed",
        variant: "destructive",
        duration: 3000,
      });

    } catch (error) {
      console.error('[ZoomToFeature] Error zooming to feature:', error);
      toast({
        title: "Zoom Failed",
        description: error instanceof Error ? error.message : "An error occurred while zooming",
        variant: "destructive",
        duration: 3000,
      });
    }
  }, [currentMapView, features, toast]);

  // Helper: convert raw dataset code to reader-friendly label

  // Use the shared applyAnalysisEngineVisualization function

  // 🎯 IMPROVED: Handle contextual chat without triggering new analysis
  const handleContextualChat = async (query: string) => {
    console.log('[Contextual Chat] Starting contextual response for:', query);
    console.log('[Contextual Chat] Using cached context:', {
      featuresCount: features.length,
      hasVisualization: !!currentVisualizationLayer.current,
      lastEndpoint: lastAnalysisEndpoint,
      messagesCount: messages.length
    });
    
    let requestPayload: any = null; // Declare at function scope for error handling
    
    try {
      setIsProcessing(true);
      // Clear any previous errors since this is contextual
      setError(null);
      setProcessingError(null);
      
      // Add user message to chat
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: query,
        timestamp: new Date(),
        metadata: { context: 'contextual_chat' }
      };
      setMessages((prev: LocalChatMessage[]) => [...prev, userMessage]);
      
      // Prepare comprehensive context for Claude - use existing features and analysis data
      const contextualData = {
        // Current analysis results
        features: features, // Use full dataset for accurate analysis
        featuresCount: features.length,
        
        // Current visualization info
        hasVisualization: !!currentVisualizationLayer.current,
        visualizationType: currentVisualizationLayer.current?.type || null,
        
        // Analysis metadata
        lastAnalysisEndpoint,
        lastAnalysisType: lastAnalysisEndpoint ? lastAnalysisEndpoint.replace('/', '').replace(/-/g, '_') : null,
        
        // Legend data would be available through parent component context
        hasLegendData: true // We assume legend exists if we have features
      };
      
      const processedLayersForClaude = features.length > 0 ? [{
        layerId: dataSource.layerId,
        layerName: 'Current Analysis Results',
        layerType: 'polygon',
        layer: {
          id: dataSource.layerId,
          name: 'Current Analysis Results',
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        },
        features: features, // Use full dataset for accurate analysis
        extent: null,
        fields: [],
        geometryType: 'polygon',
        analysisContext: {
          endpoint: lastAnalysisEndpoint,
          totalFeatures: features.length,
          hasVisualization: !!currentVisualizationLayer.current
        }
      }] : [];
      
      // Call Claude API for contextual response
    requestPayload = {
        messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
        metadata: {
          query,
          analysisType: lastAnalysisEndpoint ? lastAnalysisEndpoint.replace('/', '').replace(/-/g, '_') : 'contextual_chat',
          relevantLayers: [dataSource.layerId],
          isContextualChat: true, // Flag to indicate this is contextual, not new analysis
      contextualData, // Include all the contextual analysis state
      // Ensure server post-processing has explicit scope hints
      analysisScope: 'project',
      // Provide target variable when available to align score fields
      targetVariable: currentTarget || undefined
        },
        featureData: processedLayersForClaude,
        persona: selectedPersona,
      };
      
      console.log('[Contextual Chat] Making API request with payload:', {
        messagesCount: requestPayload.messages.length,
        analysisType: requestPayload.metadata.analysisType,
        relevantLayers: requestPayload.metadata.relevantLayers,
        featureDataCount: requestPayload.featureData.length,
        persona: requestPayload.persona,
        hasContextualData: !!requestPayload.metadata.contextualData,
        payloadSize: JSON.stringify(requestPayload).length
      });
      
      console.log('[Contextual Chat] Full request payload:', requestPayload);
      
      const claudeResp = await fetch('/api/claude/housing-generate-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });
      
      console.log('[Contextual Chat] API Response status:', claudeResp.status, claudeResp.statusText);
      
      if (claudeResp.ok) {
        const claudeJson = await claudeResp.json();
        console.log('[Contextual Chat] API Response JSON:', claudeJson);
        
        const assistantContent = claudeJson?.content;
        
        if (assistantContent) {
          // Add assistant response to chat
          const assistantMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: assistantContent,
            timestamp: new Date(),
            metadata: { context: 'contextual_response', debugInfo: { persona: selectedPersona } }
          };
          setMessages((prev: LocalChatMessage[]) => [...prev, assistantMessage]);
          console.log('[Contextual Chat] ✅ Successfully added contextual response, content length:', assistantContent.length);
        } else {
          console.error('[Contextual Chat] ❌ No content in response:', claudeJson);
          throw new Error('No content received from Claude API - response structure: ' + JSON.stringify(claudeJson));
        }
      } else {
        console.error('[Contextual Chat] ❌ API Request failed with status:', claudeResp.status);
        
        let errorData;
        try {
          errorData = await claudeResp.json();
          console.error('[Contextual Chat] Error response body:', errorData);
        } catch (parseError) {
          console.error('[Contextual Chat] Failed to parse error response:', parseError);
          errorData = { error: 'Failed to parse error response' };
        }
        
        const errorText = await claudeResp.text().catch(() => 'Could not read response text');
        console.error('[Contextual Chat] Raw error response text:', errorText);
        
        throw new Error(errorData.error || `Claude API request failed: ${claudeResp.status} ${claudeResp.statusText}. Response: ${errorText}`);
      }
      
    } catch (error) {
      console.error('[Contextual Chat] ❌ FULL ERROR DETAILS:', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        requestPayload: requestPayload ? {
          messagesCount: requestPayload?.messages?.length,
          analysisType: requestPayload?.metadata?.analysisType,
          hasFeatureData: !!requestPayload?.featureData?.length
        } : 'requestPayload not yet defined',
        contextState: {
          featuresCount: features.length,
          hasVisualization: !!currentVisualizationLayer.current,
          lastEndpoint: lastAnalysisEndpoint
        }
      });
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      toast({
        title: "Chat Error",
        description: `Failed to get contextual response: ${errorMessage.substring(0, 100)}...`,
        variant: "destructive",
        duration: 8000,
      });
      
      // Add detailed error message to chat
      const chatErrorMessage: ChatMessage = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: `I'm sorry, I encountered an error while processing your question: ${errorMessage}\n\nPlease try rephrasing your question or starting a new analysis.`,
        timestamp: new Date(),
        metadata: { context: 'error_response', debugInfo: { error: errorMessage } }
      };
      setMessages((prev: LocalChatMessage[]) => [...prev, chatErrorMessage]);
    } finally {
      console.log('[Contextual Chat] 🏁 Setting isProcessing to false');
      setIsProcessing(false);
    }
  };

  // Generate contextual placeholder text based on current analysis state
  const getContextualPlaceholder = (): string => {
    // If there are existing results, suggest follow-up questions
    if (features.length > 0 || lastAnalysisEndpoint) {
      const placeholders = [
        "Ask a question about this analysis...",
        "What would you like to know about these results?",
        "Ask for more details or insights...",
        "How can I help explain this data?",
        "What specific aspect interests you?"
      ];
      return placeholders[Math.floor(Math.random() * placeholders.length)];
    }
    
    // No analysis yet, suggest starting one
    const startingPlaceholders = [
      "Ask about Nike's market opportunities...",
      "Try: 'Show me strategic markets for Nike expansion'",
      "Ask: 'Compare Nike vs Adidas performance'",
      "Try: 'Which areas have ideal customer demographics?'",
      "Ask about brand positioning or market analysis..."
    ];
    return startingPlaceholders[Math.floor(Math.random() * startingPlaceholders.length)];
  };

  // Generate smart suggestions based on current analysis context
  const getSmartSuggestions = (): string[] => {
    if (!lastAnalysisEndpoint) return [];

    const suggestions: Record<string, string[]> = {
      'strategic-analysis': [
        "Why is this area ranked #1?",
        "What makes these markets strategic?",
        "Which factors drive the high scores?",
        "How reliable is this ranking?"
      ],
      'competitive-analysis': [
        "Where does Nike have the biggest advantage?",
        "Why does Adidas perform better here?",
        "What's driving the brand differences?",
        "Which markets are most competitive?"
      ],
      'demographic-insights': [
        "What demographics drive this pattern?",
        "Why do these areas score high?",
        "Which age groups are most important?",
        "How does income affect these results?"
      ],
      'comparative-analysis': [
        "What explains the performance difference?",
        "Which area has better demographics?",
        "Why does one outperform the other?",
        "What should we focus on?"
      ]
    };

    const endpointKey = lastAnalysisEndpoint.replace('/', '');
    return suggestions[endpointKey] || [
      "What does this data tell us?",
      "Why do we see this pattern?",
      "What should we focus on?",
      "How can we use these insights?"
    ];
  };

  const handleSubmit = async (query: string, source: 'main' | 'reply' = 'main') => {
    console.log('🚨 [FUNCTION CALL] handleSubmit called with query:', query);
    console.log('🚨 [FUNCTION CALL] source:', source);
    
    // Handle overlapping queries - prevent new queries while processing
    if (isProcessing) {
      console.warn('[QueryManager] Query already in progress, ignoring new query:', query);
      toast({
        title: "Query in Progress",
        description: "Please wait for the current analysis to complete before starting a new one.",
        variant: "default",
        duration: 3000,
      });
      return;
    }

    // 🎯 SIMPLIFIED: Chat Mode Processing
    if (source === 'reply') {
      console.log('[Chat Mode] Processing chat query:', query);
      
      // Check if we have existing analysis context (features or visualization)
      const hasExistingContext = features.length > 0 || currentVisualizationLayer.current;
      console.log('[Chat Mode] Existing context available:', hasExistingContext);
      
      if (hasExistingContext) {
        // Always treat chat mode queries with existing context as contextual chat
        console.log('[Chat Mode] ✅ Routing to contextual chat (preserving analysis context)');
        console.log('[Chat Mode] Features count:', features.length);
        console.log('[Chat Mode] Has visualization layer:', !!currentVisualizationLayer.current);
        return await handleContextualChat(query);
      } else {
        // No existing context, treat as new analysis
        console.log('[Chat Mode] ❌ No existing context, treating as new analysis');
        // Continue with existing logic below
      }
    }
    
    // Check if there are existing results and warn user (optional auto-clear)
    if (features.length > 0 || currentVisualizationLayer.current) {
      console.log('[QueryManager] Existing results detected, auto-clearing before new query');
      toast({
        title: "Previous Results Cleared",
        description: "Automatically cleared previous analysis to start new query. Use the Clear button manually if preferred.",
        variant: "default",
        duration: 2000,
      });
    }
    
    const startTime = Date.now();
    console.log('[AnalysisEngine Integration] Starting enhanced analysis workflow');

    // --- STATE RESET (same as original) ---
    setIsProcessing(true);
    setCancelRequested(false);
    setError(null);
    setProcessingError(null);
    setFeatures([]);
    setFormattedLegendData({ items: [] });
    
    // Clear cached datasets to prevent memory leaks (automatic cleanup)
    console.log('[QueryManager] Auto-clearing previous analysis data');
    clearAnalysis();
    
    // Clear existing visualization layer
    if (currentVisualizationLayer.current) {
      console.log('[AnalysisEngine] 🗑️ REMOVING EXISTING LAYER:', {
        layerId: currentVisualizationLayer.current.id,
        layerTitle: currentVisualizationLayer.current.title,
        reason: 'clearVisualization called',
        callStack: new Error().stack?.split('\n')[1]
      });
      if (currentMapView && currentMapView.map) {
        try {
          currentMapView.map.remove(currentVisualizationLayer.current);
        } catch (error) {
          console.warn('[GeospatialChat] Error removing visualization layer:', error);
        }
        // IMPORTANT: Destroy the layer to free memory
        if (typeof (currentVisualizationLayer.current as any).destroy === 'function') {
          (currentVisualizationLayer.current as any).destroy();
        }
      }
      currentVisualizationLayer.current = null;
    }
    
    // Clear any graphics
    if (currentMapView) {
      currentMapView.graphics.removeAll();
    }
    onVisualizationLayerCreated(null, true);

    setCurrentProcessingStep('query_analysis');
    setDebugInfo({
      query,
      timestamp: new Date().toISOString(),
      logs: [],
      layerMatches: [],
      sqlQuery: "",
      features: [],
      timing: {},
      error: undefined
    });

    // Initialize processing steps
    setProcessingSteps([
      { id: 'query_analysis', name: 'Query Analysis', status: 'processing', message: 'Understanding your query...' },
      { id: 'microservice_request', name: 'AI Processing', status: 'pending', message: 'Preparing analysis request...' },
      { id: 'data_loading', name: 'Data Loading', status: 'pending', message: 'Loading geographic data...' },
      { id: 'data_joining', name: 'Data Integration', status: 'pending', message: 'Merging analysis with geographic data...' },
      { id: 'visualization', name: 'Visualization', status: 'pending', message: 'Creating map visualization...' },
      { id: 'narrative_generation', name: 'Report Generation', status: 'pending', message: 'Generating narrative analysis...' }
    ]);

    // Setup messages (same as original)
    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `assistant-${Date.now() + 1}`;

    const userMessage: LocalChatMessage = {
      id: userMessageId,
      role: 'user',
      content: query,
      timestamp: new Date(),
    };

    const assistantMessage: LocalChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: 'Processing your query...',
      timestamp: new Date(),
      metadata: {
        analysisResult: {},
        context: '',
        debugInfo: {},
        isStreaming: false
      }
    };

    setMessages((prev: LocalChatMessage[]) => [...prev, userMessage, assistantMessage]);
    addContextMessage({ role: 'user', content: query });

    try {
      // Check for cancellation before starting
      if (cancelRequested) {
        console.log('[QueryManager] Cancellation detected before analysis start');
        return;
      }

      // --- ENHANCED: AnalysisEngine Integration ---
      console.log('[AnalysisEngine] Executing analysis with enhanced engine');
      
      // Debug clustering configuration
      console.log('🚨🚨🚨 [CLUSTER STATE DEBUG] Cluster config state:', {
        enabled: clusterConfig.enabled,
        numClusters: clusterConfig.numClusters,
        minScorePercentile: clusterConfig.minScorePercentile,
        methodAutoDetected: 'from-endpoint',
        willPassToAnalysis: clusterConfig.enabled ? 'YES' : 'NO',
        fullConfig: clusterConfig,
        isDefaultConfig: clusterConfig.enabled === false,
        userNeedsToEnableClustering: !clusterConfig.enabled
      });

      const analysisOptions: AnalysisOptions = {
        sampleSize: sampleSizeValue || 5000,
        targetVariable: currentTarget,
        forceRefresh: false, // Use caching for better performance
        // Use selected endpoint if not 'auto'
        endpoint: selectedEndpoint !== 'auto' ? selectedEndpoint : undefined,
        // Always pass clustering configuration
        clusterConfig: clusterConfig
      };

      // Execute analysis using our new AnalysisEngine
      console.log('🚨🚨🚨 [EXECUTION PATH] About to call executeAnalysis - this should appear!');
      console.log('🚨🚨🚨 [STRATEGIC DEBUG] Starting AnalysisEngine with options:', analysisOptions);
      console.log('🎯 [CLUSTER DEBUG] Final clusterConfig in options:', {
        ...analysisOptions.clusterConfig,
        willApplyClustering: analysisOptions.clusterConfig?.enabled ? 'YES' : 'NO'
      });
      console.log('🎯 [CLUSTER DEBUG] ABOUT TO CALL executeAnalysis with query:', query);
      
      // If switching endpoints between runs, clear previous engine state
      if (lastAnalysisEndpoint && selectedEndpoint !== 'auto') {
        const nextEndpointPath = `/${selectedEndpoint}`;
        if (nextEndpointPath !== lastAnalysisEndpoint) {
          console.log('[AnalysisEngine] 🔄 Endpoint changed between runs. Clearing previous analysis state.');
          clearAnalysis();
        }
      }

  // Set dataset cache key using endpoint + target + geometry presence
  const endpointKey = selectedEndpoint !== 'auto' ? `/${selectedEndpoint}` : (lastAnalysisEndpoint || 'auto');
  const newCacheKey = `${endpointKey}|target=${currentTarget}|geom=${Boolean(selectedGeometry)}`;
  setDatasetCacheKey(newCacheKey);

  const analysisResult: AnalysisResult = await executeAnalysis(query, analysisOptions);
      
      console.log('🎯 [CLUSTER DEBUG] AnalysisResult received:', {
        success: analysisResult.success,
        endpoint: analysisResult.endpoint,
        dataType: analysisResult.data?.type,
        recordCount: analysisResult.data?.records?.length,
        isClustered: analysisResult.data?.isClustered,
        hasVisualization: !!analysisResult.visualization,
        visualizationType: analysisResult.visualization?.type
      });
      
      // Check for cancellation after analysis
      if (cancelRequested) {
        console.log('[QueryManager] Cancellation detected after analysis');
        return;
      }
      
      // EXPLICIT DEBUG FOR STRATEGIC ANALYSIS
      if (query.toLowerCase().includes('strategic')) {
        console.log('🚨🚨🚨 [STRATEGIC DEBUG] AnalysisEngine returned:');
        console.log('🚨🚨🚨 Success:', analysisResult.success);
        console.log('🚨🚨🚨 Endpoint:', analysisResult.endpoint);
        console.log('🚨🚨🚨 Data type:', analysisResult.data?.type);
        console.log('🚨🚨🚨 Records count:', analysisResult.data?.records?.length);
        if (analysisResult.data?.records?.length > 0) {
          console.log('🚨🚨🚨 First 3 record values:');
          analysisResult.data.records.slice(0, 3).forEach((record, i) => {
            console.log(`🚨🚨🚨   ${i+1}. ${record.area_name}: value=${record.value}`);
          });
          
          // Check for the 79.3 issue
          const values = analysisResult.data.records.slice(0, 5).map((r: any) => r.value);
          const uniqueValues = [...new Set(values)];
          if (uniqueValues.length === 1) {
            console.log('🚨🚨🚨 PROBLEM IDENTIFIED: All AnalysisEngine values are identical!');
            console.log('🚨🚨🚨 All values:', values);
          } else {
            console.log('🚨🚨🚨 AnalysisEngine values are distinct:', uniqueValues);
          }
        }
      }
      
      console.log('[AnalysisEngine] Analysis complete:', {
        success: analysisResult.success,
        dataPoints: analysisResult.data?.records?.length || 0,
        visualizationType: analysisResult.visualization?.type,
        firstRecord: analysisResult.data?.records?.[0] ? {
          area_id: analysisResult.data.records[0].area_id,
          area_name: analysisResult.data.records[0].area_name,
          value: analysisResult.data.records[0].value,
          hasGeometry: !!(analysisResult.data.records[0] as any).geometry,
          geometryType: (analysisResult.data.records[0] as any).geometry?.type
        } : 'No records from analysis',
        processingTime: Date.now() - startTime,
        endpoint: analysisResult.endpoint
      });

      if (!analysisResult.success) {
        throw new Error(analysisResult.error || 'Analysis failed');
      }

      // Additional validation: ensure we have valid data structure
      if (!analysisResult.data || !analysisResult.data.records || !Array.isArray(analysisResult.data.records)) {
        console.error('[AnalysisEngine] Invalid analysis result structure:', {
          hasData: !!analysisResult.data,
          hasRecords: !!analysisResult.data?.records,
          recordsType: typeof analysisResult.data?.records,
          isArray: Array.isArray(analysisResult.data?.records)
        });
        throw new Error('Analysis result missing valid records array');
      }

      if (analysisResult.data.records.length === 0) {
        console.warn('[AnalysisEngine] Analysis returned no data records');
        throw new Error('Analysis returned no data records to visualize');
      }

      // --- INTEGRATION: Convert AnalysisEngine result to existing format ---
      
      // Update processing steps to complete
      setProcessingSteps((prev: GeoProcessingStep[]) => prev.map(s => 
        s.id === 'narrative_generation' ? { ...s, status: 'processing' as any } : { ...s, status: 'complete' as any }
      ));
      setCurrentProcessingStep('narrative_generation');

      // --- FIXED: Properly join AnalysisEngine data with geographic features ---
      console.log('🚨 [DEBUG] GEOGRAPHIC JOIN SECTION REACHED - This should appear in console logs');
      console.log('[AnalysisEngine] Joining analysis data with geographic features');
      console.log('[AnalysisEngine] Analysis result data:', {
        hasData: !!analysisResult.data,
        hasRecords: !!analysisResult.data?.records,
        recordCount: analysisResult.data?.records?.length || 0,
        sampleRecord: analysisResult.data?.records?.[0] ? {
          hasID: !!(analysisResult.data.records[0] as any).ID,
          ID: (analysisResult.data.records[0] as any).ID,
          keys: Object.keys(analysisResult.data.records[0]).slice(0, 5)
        } : null
      });
      
      // --- FIXED: Join analysis data with cached ZIP Code polygon boundaries ---
      console.log('[AnalysisEngine] Loading ZIP Code polygon boundaries for visualization');
      
      let geographicFeatures: FeatureType[] = [];
      
      try {
        // Load the cached ZIP Code polygon boundaries (fast, reliable)
        console.log('[AnalysisEngine] About to call loadGeographicFeatures...');
        
        const loadingStartTime = Date.now();
        geographicFeatures = await loadGeographicFeatures().then(features => {
          console.log('[AnalysisEngine] loadGeographicFeatures resolved with:', features.length, 'features');
          return features.filter((f): f is FeatureType => f !== null);
        });
        
        const loadingTime = Date.now() - loadingStartTime;
        console.log('[AnalysisEngine] ✅ ZIP Code polygon boundaries loaded:', {
          count: geographicFeatures.length,
          loadingTime: `${loadingTime}ms`,
          sampleFeature: geographicFeatures[0] ? {
            hasGeometry: !!geographicFeatures[0].geometry,
            hasProperties: !!geographicFeatures[0].properties,
            sampleId: geographicFeatures[0].properties?.ID
          } : null
        });
        
        if (geographicFeatures.length === 0) {
          throw new Error('loadGeographicFeatures returned empty array');
        }
        
      } catch (geoError) {
        console.error('[AnalysisEngine] ❌ Failed to load ZIP Code boundaries:', {
          error: geoError,
          errorMessage: geoError instanceof Error ? geoError.message : String(geoError),
          errorStack: geoError instanceof Error ? geoError.stack : undefined
        });
        
        // CRITICAL: We need actual ZIP Code boundaries for proper visualization
        throw new Error(`Cannot load ZIP Code boundaries from cache: ${geoError}. This is required for geographic visualization.`);
      }

      // Join analysis data with ZIP Code polygon boundaries
      console.log('🚨 [STRUCTURE DEBUG] Analysis result data structure:', {
        hasAnalysisResult: !!analysisResult,
        hasData: !!analysisResult.data,
        hasRecords: !!analysisResult.data?.records,
        recordCount: analysisResult.data?.records?.length || 0,
        firstRecord: analysisResult.data?.records?.[0] ? {
          allKeys: Object.keys(analysisResult.data.records[0]),
          hasID: 'ID' in analysisResult.data.records[0],
          ID_value: (analysisResult.data.records[0] as any).ID,
          ID_type: typeof (analysisResult.data.records[0] as any).ID,
          sampleFields: Object.keys(analysisResult.data.records[0]).slice(0, 10)
        } : 'NO FIRST RECORD'
      });
      
      // DEBUG: Check joining data before processing (with safety checks)
      console.log('[AnalysisEngine] About to join data:', {
        analysisRecords: analysisResult.data?.records?.length || 0,
        geographicFeatures: geographicFeatures.length,
        sampleAnalysisRecord: analysisResult.data?.records?.[0] || null,
        sampleGeographicFeature: geographicFeatures[0] ? {
          properties: geographicFeatures[0].properties,
          geometryType: geographicFeatures[0].geometry?.type
        } : null
      });

      const targetVariable = analysisResult.data.targetVariable || 'analysis_score';
      console.log(`🎯 [JOIN] Target variable for this analysis: ${targetVariable}`);
      
      // ALWAYS perform geographic join - clustered data also needs geometry!
      console.log('[AnalysisEngine] 🎯 Performing geographic join for all data (including clustered)');
      if (analysisResult.data.isClustered) {
        console.log('[AnalysisEngine] 🎯 Clustered data detected - will join ZIP codes with their geometries');
      }
      
      // Geographic join process for all data (clustered and non-clustered)
      const joinedResults = analysisResult.data.records.map((record: any, index: number) => {
        // ENHANCED: Extract ZIP Code from AnalysisEngine record structure
        // Check multiple possible locations for the ID field
        const recordAreaId = (record as any).area_id;
        const recordPropertiesID = (record as any).properties?.ID;
        const recordPropertiesId = (record as any).properties?.id;
        const recordDirectID = (record as any).ID;
        const recordDirectId = (record as any).id;
        
        // Additional fields to check
        const recordZIP = (record as any).ZIP || (record as any).properties?.ZIP;
        const recordZIPCODE = (record as any).ZIPCODE || (record as any).properties?.ZIPCODE;
        const recordZipCode = (record as any).zip_code || (record as any).properties?.zip_code;
        
        // Priority: properties.ID > area_id (unless area_id is numeric) > direct ID fields
        let primaryId = recordPropertiesID || recordPropertiesId || recordDirectID || recordDirectId;
        
        // If area_id is numeric (not area_XXXX pattern), prefer it over fallback fields
        if (recordAreaId && !String(recordAreaId).startsWith('area_')) {
          primaryId = recordAreaId;
        }
        
        // Use ID field as primary, with fallbacks
        const rawZip = String(recordZIP || recordZIPCODE || recordZipCode || primaryId || recordAreaId || `area_${index}`);
        
        // Check if this is a Canadian FSA (3 chars: letter-digit-letter) - DO NOT PAD
        const isFSA = /^[A-Z]\d[A-Z]$/i.test(rawZip);
        const recordZip = isFSA ? rawZip.toUpperCase() : rawZip.padStart(5, '0'); // Only pad numeric ZIPs to 5 digits
        
        // Debug logging for problematic records
        if (index === 2610 || index < 3 || rawZip.startsWith('area_')) {
          console.log(`🔍 [JOIN DEBUG] Record ${index}:`, {
            recordAreaId,
            recordPropertiesID,
            recordPropertiesId,
            recordDirectID,
            recordDirectId,
            primaryId,
            rawZip,
            recordZip,
            fallbackUsed: rawZip.startsWith('area_'),
            availableFields: Object.keys(record).slice(0, 10),
            propertiesKeys: record.properties ? Object.keys(record.properties).slice(0, 10) : 'no properties'
          });
        }
        
        // Find matching boundary by ID (supports both ZIP codes and FSAs)
        const zipFeature = geographicFeatures.find(f => {
          if (!f?.properties) return false;
          
          // For FSAs (3 chars: letter-digit-letter), match without padding
          if (isFSA) {
            return (
              String(f.properties.ID || '').toUpperCase() === recordZip ||
              String(f.properties.FSA_ID || '').toUpperCase() === recordZip ||
              String(f.properties.POSTAL_CODE || '').toUpperCase() === recordZip ||
              // Extract FSA from DESCRIPTION: "G0A (La Sarre)" -> "G0A"
              f.properties.DESCRIPTION?.match(/^([A-Z]\d[A-Z])/i)?.[1]?.toUpperCase() === recordZip
            );
          }
          
          // For US ZIP codes (numeric), use padding for comparison only when both are numeric
          const propID = String(f.properties.ID || '');
          const propZIP = String(f.properties.ZIP || '');
          const propZIPCODE = String(f.properties.ZIPCODE || '');
          const propOBJECTID = String(f.properties.OBJECTID || '');
          
          // Helper function: only pad if both values are numeric (ZIP codes), not FSA codes
          const compareWithConditionalPadding = (boundaryValue: string, recordValue: string) => {
            const isRecordNumeric = /^\d+$/.test(recordValue);
            const isBoundaryNumeric = /^\d+$/.test(boundaryValue);
            
            // If both are numeric (ZIP codes), pad for comparison
            if (isRecordNumeric && isBoundaryNumeric) {
              return boundaryValue.padStart(5, '0') === recordValue.padStart(5, '0');
            }
            // Otherwise, compare as-is (handles FSAs)
            return boundaryValue === recordValue;
          };
          
          return (
            compareWithConditionalPadding(propID, recordZip) ||
            compareWithConditionalPadding(propZIP, recordZip) ||
            compareWithConditionalPadding(propZIPCODE, recordZip) ||
            // Extract ZIP from DESCRIPTION: "08837 (Edison)" -> "08837"
            f.properties.DESCRIPTION?.match(/^(\d{5})/)?.[1] === recordZip ||
            compareWithConditionalPadding(propOBJECTID, recordZip)
          );
        });

        // Debug logging for problematic records
        if (index === 3137 || index < 3 || rawZip.startsWith('area_')) {
          console.log(`🔍 [JOIN DEBUG] Record ${index} match:`, {
            recordZip,
            foundMatch: !!zipFeature,
            zipFeatureId: zipFeature?.properties?.ID,
            zipFeatureDesc: zipFeature?.properties?.DESCRIPTION?.substring(0, 30)
          });
        }

        // Create record with actual ZIP Code polygon geometry and proper area name
        if (zipFeature) {
          // SUCCESS: Use boundary data for name and geometry
          const zipDescription = zipFeature.properties?.DESCRIPTION || '';
          const zipMatch = zipDescription.match(/^(\d{5})\s*\(([^)]+)\)/);
          const zipCode = zipMatch?.[1] || recordZip;
          const cityName = zipMatch?.[2] || 'Unknown City';
          
          // FIXED: Preserve competitive analysis data during geographic join
          const isCompetitiveAnalysis = analysisResult.data.type === 'competitive_analysis';
          const competitiveFields = ['value', 'competitive_advantage_score', analysisResult.data.targetVariable];
          
          console.log(`🔧 [JOIN DEBUG] Record ${index} (${record.area_name}):`);
          console.log(`   isCompetitiveAnalysis: ${isCompetitiveAnalysis}`);
          console.log(`   record.value BEFORE join: ${record.value}`);
          console.log(`   record.properties[${analysisResult.data.targetVariable}] BEFORE join: ${record.properties?.[analysisResult.data.targetVariable]}`);
          
          // Preserve original competitive data
          const preservedProps = { ...record.properties };
          const zipProps = { ...(zipFeature.properties || {}) };
          
          // Debug what's in ZIP boundary that might conflict
          console.log(`   ZIP boundary conflicting fields:`, 
            competitiveFields.filter(field => zipProps[field] !== undefined)
              .map(field => `${field}=${zipProps[field]}`));
          
          // For competitive analysis, don't let ZIP boundary overwrite competitive fields
          if (isCompetitiveAnalysis) {
            competitiveFields.forEach(field => {
              if (preservedProps[field] !== undefined && zipProps[field] !== undefined) {
                console.log(`   🔧 Removing conflicting ${field}: ${zipProps[field]} → deleted`);
                delete zipProps[field]; // Remove conflicting field from ZIP boundary
              }
            });
          }
          
          const joinedRecord = {
            ...record,
            area_id: zipCode,
            area_name: `${zipCode} (${cityName})`,
            geometry: zipFeature.geometry, // Use actual ZIP Code polygon boundaries
            properties: {
              ...preservedProps,  // Original competitive data first
              ...zipProps,        // ZIP boundary data (without conflicts)
              zip_code: zipCode,
              city_name: cityName,
              // CRITICAL: Add BOTH targetVariable AND 'value' fields for renderer access
              [targetVariable]: record[targetVariable] || record.value || preservedProps[targetVariable] || 0,
              // Use centralized field mapping to get the correct score value
              value: extractScoreValue(record, analysisResult.data.type, analysisResult.data.targetVariable)
            }
          };
          
          console.log(`   🔧 AFTER join - record.value: ${joinedRecord.value}`);
          console.log(`   🔧 AFTER join - properties[${analysisResult.data.targetVariable}]: ${joinedRecord.properties?.[analysisResult.data.targetVariable]}`);
          
          return joinedRecord;
        } else {
          // FAILURE: No match found, use fallback
                     console.warn(`❌ [JOIN] No boundary match for record ${index}, ID: ${primaryId}, rawZip: ${rawZip}`);
          return {
            ...record,
            area_id: rawZip,
            area_name: rawZip.startsWith('area_') ? rawZip : `${rawZip} (No boundary data)`,
            geometry: null, // No geometry available
            properties: {
              ...record.properties,
              zip_code: rawZip,
              city_name: 'No boundary data',
              // CRITICAL: Add BOTH targetVariable AND 'value' fields even without boundary match
              [targetVariable]: record[targetVariable] || record.value || record.properties?.[targetVariable] || 0,
              // Use centralized field mapping to get the correct score value
              value: extractScoreValue(record, analysisResult.data.type, analysisResult.data.targetVariable)
            }
          };
        }
      });

      // CRITICAL DEBUG: Check join results
      console.log('[AnalysisEngine] ❗ JOIN RESULTS DEBUG:', {
        totalRecords: joinedResults.length,
        recordsWithGeometry: joinedResults.filter(r => r.geometry !== null).length,
        recordsWithoutGeometry: joinedResults.filter(r => r.geometry === null).length,
        geometryTypes: [...new Set(joinedResults.map(r => r.geometry?.type).filter(Boolean))],
        firstRecord: joinedResults[0] ? {
          area_id: joinedResults[0].area_id,
          area_name: joinedResults[0].area_name,
          hasGeometry: joinedResults[0].geometry !== null,
          geometryType: joinedResults[0].geometry?.type,
          geometryCoords: joinedResults[0].geometry?.coordinates ? 'Present' : 'Missing',
          value: joinedResults[0].value
        } : 'No records'
      });

      if (joinedResults.filter(r => r.geometry !== null).length === 0) {
        console.error('[AnalysisEngine] 🔥 CRITICAL: NO RECORDS WITH GEOMETRY AFTER JOIN - VISUALIZATION WILL FAIL');
        console.error('[AnalysisEngine] Sample analysis IDs:', analysisResult.data.records.slice(0, 5).map(r => r.area_id || (r as any).ID || 'no-id'));
        console.error('[AnalysisEngine] Sample boundary IDs:', geographicFeatures.slice(0, 5).map(f => f.properties?.ID || 'no-id'));
      }

      console.log('[AnalysisEngine] Enhanced results created:', {
        totalRecords: joinedResults.length,
        withRealGeometry: joinedResults.filter(r => r.geometry?.type === 'Polygon').length,
        withFallbackGeometry: joinedResults.filter(r => r.geometry?.type === 'Point').length,
        sampleRecord: joinedResults[0] ? {
          area_name: joinedResults[0].area_name,
          value: joinedResults[0].value,
          hasGeometry: !!joinedResults[0].geometry
        } : null
      });

      // Update the analysis result with joined data
      const enhancedAnalysisResult = {
        ...analysisResult,
        data: {
          ...analysisResult.data,
          records: joinedResults
        }
      };

      // 🎯 CLUSTERING: Apply clustering AFTER geometry join (when we have real ZIP code geometries)
      let finalAnalysisResult = enhancedAnalysisResult;
      
      console.log('🚨🚨🚨 [EXECUTION TRACE] About to check clustering condition - THIS LINE SHOULD ALWAYS APPEAR');
      console.log('🚨🚨🚨 [EXECUTION TRACE] Current analysisOptions.clusterConfig:', analysisOptions.clusterConfig);
      
      // Check if clustering is enabled in analysis options
      console.log('🚨🚨🚨 [CLUSTERING DEBUG] Checking clustering condition:', {
        hasClusterConfig: !!analysisOptions.clusterConfig,
        clusterConfig: analysisOptions.clusterConfig,
        isEnabled: analysisOptions.clusterConfig?.enabled,
        conditionResult: analysisOptions.clusterConfig && analysisOptions.clusterConfig.enabled
      });
      
      // Only allow clustering for strategic and demographic analyses (not competitive/comparative)
      const supportsClusteringEndpoints = ['/strategic-analysis', '/demographic-insights'];
      const currentEndpoint = finalAnalysisResult.endpoint;
      const supportsClustering = supportsClusteringEndpoints.includes(currentEndpoint);
      
      console.log(`🔥 [CLUSTERING DEBUG] Checking clustering for endpoint: ${currentEndpoint}`, {
        hasClusterConfig: !!analysisOptions.clusterConfig,
        clusteringEnabled: analysisOptions.clusterConfig?.enabled,
        supportsClustering,
        supportsClusteringEndpoints,
        willCluster: analysisOptions.clusterConfig && analysisOptions.clusterConfig.enabled && supportsClustering
      });
      
      if (analysisOptions.clusterConfig && analysisOptions.clusterConfig.enabled && supportsClustering) {
        console.log('🎯 [CLUSTERING] Applying clustering AFTER geometry join with real ZIP code geometries');
        console.log('🎯 [CLUSTERING] Config:', analysisOptions.clusterConfig);
        console.log('🎯 [CLUSTERING] Records before clustering:', {
          count: enhancedAnalysisResult.data.records.length,
          hasGeometry: enhancedAnalysisResult.data.records.filter(r => r.geometry).length,
          sampleGeometry: enhancedAnalysisResult.data.records[0]?.geometry?.type
        });
        
        try {
          // Get clustering service instance
          const clusteringService = analysisEngine.engine.getClusteringService();
          
          // Set the config before applying clustering
          clusteringService.setConfig(analysisOptions.clusterConfig);
          console.log('🎯 [CLUSTERING] Config set on service:', clusteringService.getConfig());
          
          // Apply clustering to the geometry-enhanced analysis result
          finalAnalysisResult = await clusteringService.applyClusteringToAnalysis(
            enhancedAnalysisResult,
            analysisOptions.clusterConfig
          );
          
          console.log('🎯 [CLUSTERING] Clustering applied successfully:', {
            originalRecords: enhancedAnalysisResult.data.records.length,
            clusteredRecords: finalAnalysisResult.data.records.length,
            isClustered: finalAnalysisResult.data.isClustered,
            clusterCount: finalAnalysisResult.data.clusters?.length || 0
          });
          
          // Regenerate visualization for clustered data
          const clusterVisualization = analysisEngine.engine.modules.visualizationRenderer.createVisualization(
            finalAnalysisResult.data, 
            finalAnalysisResult.endpoint
          );
          
          finalAnalysisResult = {
            ...finalAnalysisResult,
            visualization: clusterVisualization
          };
          
          console.log('🎯 [CLUSTERING] New visualization created:', {
            type: clusterVisualization?.type,
            hasRenderer: !!clusterVisualization?.renderer,
            // Cast to any to avoid strict '{}' typing on renderer
            rendererType: (clusterVisualization?.renderer as any)?.type,
            isClusterRenderer: clusterVisualization?.type === 'cluster'
          });
          
        } catch (error) {
          console.error('🎯 [CLUSTERING] Clustering failed:', error);
          // Continue with non-clustered result if clustering fails
        }
      } else {
        if (!supportsClustering) {
          console.log(`🎯 [CLUSTERING] Skipping clustering - endpoint '${currentEndpoint}' does not support clustering`);
        } else {
          console.log('🎯 [CLUSTERING] Skipping clustering - not enabled or configured');
        }
      }
      console.log('🚨 [FLOW CHECK] First record targetVariable:', finalAnalysisResult.data.records[0]?.properties?.[finalAnalysisResult.data.targetVariable]);
      console.log('🚨 [FLOW CHECK] Data type:', finalAnalysisResult.data.type);

      // --- ENHANCED: Use AnalysisEngine's advanced visualization system ---
      console.log('[AnalysisEngine] Applying advanced visualization system');
      console.log('[AnalysisEngine] Enhanced data check:', {
        totalRecords: finalAnalysisResult.data.records.length,
        recordsWithGeometry: finalAnalysisResult.data.records.filter((r: any) => r.geometry).length,
        sampleRecordGeometry: finalAnalysisResult.data.records[0]?.geometry?.type,
        sampleRecordId: finalAnalysisResult.data.records[0]?.area_id,
        sampleRecordName: finalAnalysisResult.data.records[0]?.area_name,
        isClustered: finalAnalysisResult.data.isClustered
      });
      
      // Create visualization data from final analysis result (may be clustered)
      const visualizationData = {
        ...finalAnalysisResult.data,
        records: finalAnalysisResult.data.records
      };
      
      console.log('[AnalysisEngine] Data flow separation:', {
        originalDataRecords: finalAnalysisResult.data.records.length,
        visualizationDataRecords: visualizationData.records.length,
        preservingFullDataForAnalysis: true,
        isClustered: visualizationData.isClustered
      });
      
      // Apply visualization with separated data flow
      // For clustered data, ensure clean layer state to avoid conflicts
      if (finalAnalysisResult.data.isClustered && currentMapView) {
        console.log('🎯 [CLUSTERING] Clearing existing layers before creating cluster visualization');
        
        // Remove any existing analysis layers to prevent conflicts
        const existingLayers = currentMapView.map.layers.toArray().filter(layer => 
          layer.id && (layer.id.includes('analysis') || layer.id.includes('layer'))
        );
        
        existingLayers.forEach(layer => {
          console.log('🎯 [CLUSTERING] Removing existing layer:', layer.id);
          currentMapView.map.remove(layer);
        });
      }
      
      if (!finalAnalysisResult.visualization) {
        console.error('[AnalysisEngine] No visualization result available');
        return;
      }
      
      const visualization = finalAnalysisResult.visualization;
  const createdLayer = await applyAnalysisEngineVisualization(visualization, visualizationData, currentMapView, setFormattedLegendData, undefined, { callerId: 'geospatial-chat-interface' });
      
      // Pass the created layer to the callback
      console.log('[AnalysisEngine] Layer creation result:', {
        hasLayer: !!createdLayer,
        layerId: createdLayer?.id,
        layerTitle: createdLayer?.title,
        layerType: createdLayer?.type
      });
      
      if (createdLayer) {
        console.log('[AnalysisEngine] ✅ Visualization layer created successfully:', createdLayer.title);
        console.log('[AnalysisEngine] Calling onVisualizationLayerCreated with layer:', createdLayer.id);
        onVisualizationLayerCreated(createdLayer, true);
        
        // CRITICAL FIX: Update features state with processed competitive scores
        if (finalAnalysisResult.data.type === 'competitive_analysis') {
          console.log('🔄 [FEATURES SYNC] Updating features state with competitive scores...');
          
          // Create features with competitive advantage scores instead of raw market share
          const competitiveFeatures = finalAnalysisResult.data.records.map((record: any) => ({
            type: 'Feature',
            geometry: record.geometry,
            properties: {
              ...record.properties,
              // Ensure competitive scores are used, not market share
              [finalAnalysisResult.data.targetVariable]: record.value, // Use the competitive score as target variable
              competitive_advantage_score: record.properties?.competitive_advantage_score || record.value,
              // Keep market share as context but don't let it override competitive scores
              nike_market_share_context: record.properties?.nike_market_share || record.properties?.value_MP30034A_B_P,
              adidas_market_share_context: record.properties?.adidas_market_share || record.properties?.value_MP30029A_B_P
            }
          }));
          
          console.log('🔄 [FEATURES SYNC] Sample competitive feature:', {
            area_name: competitiveFeatures[0]?.properties?.area_name,
            [finalAnalysisResult.data.targetVariable]: competitiveFeatures[0]?.properties?.[finalAnalysisResult.data.targetVariable],
            competitive_advantage_score: competitiveFeatures[0]?.properties?.competitive_advantage_score,
            nike_market_share_context: competitiveFeatures[0]?.properties?.nike_market_share_context
          });
          
          // Update the features state so sendChatMessage uses competitive scores
          setFeatures(competitiveFeatures as GeospatialFeature[]);
          onFeaturesFound(competitiveFeatures, false);
        }
      } else {
        console.error('[AnalysisEngine] ❌ Failed to create visualization layer');
        onVisualizationLayerCreated(null, true);
      }


      // Create legend from AnalysisEngine result
      // Fix: Support both nested and top-level legend property from VisualizationRenderer
      const legendSource = visualization.legend || (visualization as any).legend;
      if (legendSource) {
        console.log('[AnalysisEngine] Processing legend:', legendSource);
        
        let legendData;
    if ((legendSource as any).components) {
          // Dual-variable format with components array
          legendData = {
      title: (visualization.legend as any).title,
            type: 'dual-variable',
      components: ((visualization.legend as any).components as any[]).map((component: any) => ({
              title: component.title,
              type: component.type,
              items: component.items.map((item: any) => ({
                label: item.label,
                color: item.color,
                value: item.value,
                size: item.size,
                shape: item.symbol || 'circle'
              }))
            }))
          };
    } else if ((visualization.legend as any).items) {
          // Standard format with items array
          legendData = {
      title: (visualization.legend as any).title,
      items: ((visualization.legend as any).items as any[]).map((item: any) => ({
              label: item.label,
              color: item.color,
              value: item.value,
              shape: item.symbol || 'circle'
            }))
          };
        } else {
          // Handle alternative legend formats
          console.warn('[AnalysisEngine] Unexpected legend format, creating fallback');
          legendData = {
            title: 'Competitive Analysis',
            items: [{
              label: 'Analysis Areas',
              color: '#4169E1',
              value: 0,
              shape: 'circle'
            }]
          };
        }
        
        console.log('[AnalysisEngine] Setting legend data:', legendData);
        setFormattedLegendData(legendData);
      } else {
        console.warn('[AnalysisEngine] No legend data available in visualization result');
      }

      console.log('[AnalysisEngine] Advanced visualization applied');

      // Update state - the AnalysisEngine manages its own visualization layer
      setVisualizationResult({
        type: visualization.type,
        legend: visualization.legend,
        config: visualization.config
      } as any);
      
      // Notify parent that new layer was created (layer is managed by applyAnalysisEngineVisualization)
      onVisualizationLayerCreated(currentVisualizationLayer.current, true);

      // Auto-zoom to data if configured
      if (visualization.config?.autoZoom && currentMapView && geographicFeatures.length > 0) {
        // Calculate extent from geographic features
        const [geometryEngine] = await Promise.all([
          import('@arcgis/core/geometry/geometryEngine')
        ]);
        
        const geometries = geographicFeatures
          .filter(f => f?.geometry)
          .map(f => f!.geometry);
          
        if (geometries.length > 0) {
          const union = geometryEngine.union(geometries as any);
          if (union && union.extent) {
            currentMapView.goTo(union.extent.expand(1.2), {
              duration: 1200,
              easing: 'ease-in-out'
            });
          }
        }
      }

      const validFeatures = geographicFeatures.filter(f => f !== null) as GeospatialFeature[];
      
      // CRITICAL FIX: Don't call handleFeaturesFound for AnalysisEngine results
      // This was causing the visualization to be cleared after being created
      console.log('[AnalysisEngine] 🚫 SKIPPING handleFeaturesFound to preserve visualization');
      console.log('[AnalysisEngine] Features would have been:', validFeatures.length);
      
      // handleFeaturesFound(validFeatures, true); // DISABLED to prevent visualization clearing
      
      if (currentMapView) {
        createHighlights(currentMapView, validFeatures);
      }

      // --- NARRATIVE GENERATION using existing Claude integration ---
      console.log('🚨 [FLOW CHECK] Reached narrative generation section');
      console.log('🚨 [FLOW CHECK] finalAnalysisResult exists:', !!finalAnalysisResult);
      console.log('🚨 [FLOW CHECK] finalAnalysisResult.data.records.length:', finalAnalysisResult?.data?.records?.length || 0);
      console.log('🚨 [FLOW CHECK] Is clustered:', finalAnalysisResult?.data?.isClustered);
      
      let narrativeContent: string | null = null;
      try {
        console.log('[AnalysisEngine] Generating narrative with Claude');
        
        // Debug the top 3 records being sent to Claude
        console.log('[Claude] Top 3 records being sent:', finalAnalysisResult?.data?.records?.slice(0, 3).map(r => ({
          area_name: r.area_name,
          area_id: r.area_id,
          competitive_score: r.value,
          rank: r.rank,
          cluster_id: r.cluster_id,
          is_clustered: finalAnalysisResult?.data?.isClustered
        })));
        
        setProcessingSteps((prev: GeoProcessingStep[]) => prev.map(s => 
          s.id === 'narrative_generation' ? { ...s, message: 'Preparing data for narrative analysis...' } : s
        ));

        // Save the endpoint for follow-up questions
        setLastAnalysisEndpoint(finalAnalysisResult.endpoint);
        
        // Use existing Claude integration with enhanced analysis result
        const targetPretty = TARGET_OPTIONS.find(opt => opt.value === currentTarget)?.label || 'Performance';
        
        // Check if this is clustered data and adjust the prompt accordingly
        const isClusteredAnalysis = finalAnalysisResult?.data?.summary && finalAnalysisResult.data.summary.trim().length > 0;
        const hasClusterAnalysis = isClusteredAnalysis && finalAnalysisResult.data.isClustered;
        
        console.log('🎯 [CLAUDE PAYLOAD] isClusteredAnalysis:', isClusteredAnalysis);
        console.log('🎯 [CLAUDE PAYLOAD] hasClusterAnalysis:', hasClusterAnalysis);
        
  // Build deterministic top-10 for strategic-analysis (server-ranked) to guide Claude
        const scoreCfg = getScoreConfigForEndpoint(finalAnalysisResult.endpoint);
        const primaryFieldForTop = finalAnalysisResult?.data?.targetVariable || scoreCfg.scoreFieldName;
        const allFeatureCount = (finalAnalysisResult?.data?.isClustered
          ? ((finalAnalysisResult.data as any)?.namedClusters || (finalAnalysisResult.data as any)?.clusters || [])
          : finalAnalysisResult?.data?.records || []).length;
    type SimpleItem = { name: string | undefined; id: string | undefined; value: number };
  const TOP_MARKETS_COUNT = 10;
  const systemTop5: SimpleItem[] = (() => {
          try {
            const items = finalAnalysisResult?.data?.isClustered
      ? (((finalAnalysisResult.data as any)?.namedClusters || (finalAnalysisResult.data as any)?.clusters || []).map((c: any): SimpleItem => ({
                  name: c.area_name || c.name,
                  id: c.area_id || c.id,
                  value: typeof c.avgScore === 'number' ? c.avgScore : (typeof c[primaryFieldForTop] === 'number' ? c[primaryFieldForTop] : (c.value ?? 0))
                })))
      : ((finalAnalysisResult?.data?.records || []).map((r: any): SimpleItem => ({
                  name: r.area_name,
                  id: r.area_id,
                  value: typeof r[primaryFieldForTop] === 'number' ? r[primaryFieldForTop] : (r.value ?? 0)
                })));
            return items
      .filter((it: SimpleItem) => it && !Number.isNaN(Number(it.value)))
      .sort((a: SimpleItem, b: SimpleItem) => Number(b.value) - Number(a.value))
              .slice(0, TOP_MARKETS_COUNT);
          } catch { return []; }
        })();

  const claudePayload = {
            messages: [{ 
              role: 'user', 
              content: (() => {
                const base = generateScoreDescription(finalAnalysisResult.endpoint, query);
                const scopeNote = `\n\nDATASET SCOPE: Analyze ALL ${allFeatureCount} ${finalAnalysisResult?.data?.isClustered ? 'territories' : 'areas'} in the selection. DO NOT limit your analysis to preview samples.`;
                const top5Note = (finalAnalysisResult.endpoint === '/strategic-analysis' && systemTop5.length)
                  ? `\n\nSYSTEM-COMPUTED TOP ${TOP_MARKETS_COUNT} STRATEGIC MARKETS (ranked by ${primaryFieldForTop}):\n${systemTop5.map((t: SimpleItem, i: number) => `${i+1}. ${t.name || t.id} — ${Number(t.value).toFixed(2)}`).join('\n')}\n\nUse these EXACTLY as the Top Strategic Markets list. Do not limit to fewer items.`
                  : '';
                const clusteringNote = hasClusterAnalysis 
                  ? `\n\nIMPORTANT: This is a TERRITORY CLUSTERING analysis. The data has been organized into geographic territories/clusters. Base your response on the territory clustering analysis provided in the metadata. Focus on territories rather than individual ZIP codes.`
                  : '';
                return `${base}${scopeNote}${top5Note}${clusteringNote}`;
              })()
            }],
            metadata: {
              query,
              analysisType: finalAnalysisResult.endpoint.replace('/', '').replace(/-/g, '_'), // Convert /strategic-analysis to strategic_analysis
              relevantLayers: [dataSource.layerId],
              primaryField: targetPretty,
              endpoint: finalAnalysisResult.endpoint,
              targetVariable: finalAnalysisResult.data?.targetVariable || 'analysis_score',
              analysisEndpoint: finalAnalysisResult.endpoint,
              scoreType: getScoreConfigForEndpoint(finalAnalysisResult.endpoint).scoreFieldName,
              processingTime: Date.now() - startTime,
              // CRITICAL: Include cluster analysis information
              isClustered: hasClusterAnalysis,
              clusterAnalysis: hasClusterAnalysis ? finalAnalysisResult.data.summary : null,
              // Explicit scope flags for server-side post-processing
              analysisScope: 'project',
              spatialFilterIds: []
            },
            // Use the expected ProcessedLayerResult format with REAL analysis data
            featureData: [{
              layerId: 'analysis-result',
              layerName: 'Analysis Results',  
              layerType: 'polygon',
              layer: {} as any,
              // CRITICAL FIX: Use cluster data when clustering is enabled, individual ZIP codes otherwise
              features: (() => {
                // Use namedClusters if available (with geographic names and proper scores), otherwise fall back to clusters
                const dataWithClusters = finalAnalysisResult?.data as any;
                const sourceData = hasClusterAnalysis && dataWithClusters?.namedClusters 
                  ? dataWithClusters.namedClusters 
                  : hasClusterAnalysis && dataWithClusters?.clusters 
                    ? dataWithClusters.clusters 
                    : dataWithClusters?.records;
                
                console.log(`🎯 [CLAUDE FEATUREDATA] Using ${hasClusterAnalysis ? 'CLUSTER' : 'ZIP CODE'} data for Claude:`, {
                  hasClusterAnalysis,
                  usingNamedClusters: hasClusterAnalysis && dataWithClusters?.namedClusters,
                  usingClusters: hasClusterAnalysis && dataWithClusters?.clusters,
                  recordCount: sourceData?.length || 0,
                  dataType: hasClusterAnalysis && dataWithClusters?.namedClusters ? 'named_cluster_territories' : 
                           hasClusterAnalysis ? 'cluster_territories' : 'individual_zip_codes'
                });
                
                return sourceData?.map((result: any, index: number) => {
                // Debug area names to understand the issue - handle both clusters and ZIP codes
                if (index < 5) {
                  const isCluster = hasClusterAnalysis && result.zipCount;
                  console.log(`[Claude Data] ${isCluster ? 'Cluster' : 'ZIP'} ${index + 1} - DETAILED:`, {
                    area_name: result.area_name || result.name,
                    area_id: result.area_id || result.id,
                    typeof_area_name: typeof (result.area_name || result.name),
                    typeof_area_id: typeof (result.area_id || result.id),
                    is_cluster: isCluster,
                    zip_count: result.zipCount || 1,
                    full_result_keys: Object.keys(result),
                    properties_keys: result.properties ? Object.keys(result.properties) : 'no properties'
                  });
                }
                // Extract brand market shares - fix field name mapping
                const nikeShare = result.properties?.mp30034a_b_p || result.properties?.value_MP30034A_B_P || result.value_MP30034A_B_P || result.mp30034a_b_p || 0;
                const adidasShare = result.properties?.mp30029a_b_p || result.properties?.value_MP30029A_B_P || result.value_MP30029A_B_P || result.mp30029a_b_p || 0;
                const jordanShare = result.properties?.mp30032a_b_p || result.properties?.value_MP30032A_B_P || result.value_MP30032A_B_P || result.mp30032a_b_p || 0;
                
                // Extract SHAP values for explanation
                const nikeShap = result.properties?.shap_MP30034A_B_P || result.shap_MP30034A_B_P || 0;
                const adidasShap = result.properties?.shap_MP30029A_B_P || result.shap_MP30029A_B_P || 0;
                
                // Extract demographic data  
                const totalPop = result.properties?.TOTPOP_CY || result.TOTPOP_CY || 0;
                const avgIncome = result.properties?.AVGHINC_CY || result.AVGHINC_CY || 0;
                const medianAge = result.properties?.MEDAGE_CY || result.MEDAGE_CY || 0;
                
                // Extract top SHAP features for this area
                const shapFeatures: Record<string, number> = {};
                Object.keys(result.properties || result).forEach(key => {
                  if (key.startsWith('shap_') && Math.abs((result.properties || result)[key]) > 0.1) {
                    const featureName = key.replace('shap_', '');
                    shapFeatures[featureName] = (result.properties || result)[key];
                  }
                });
                
                // Use ConfigurationManager for proper score field mapping
                const scoreConfig = getScoreConfigForEndpoint(finalAnalysisResult.endpoint);
                const scoreFieldName = scoreConfig.scoreFieldName;
                
                // Determine if this is a cluster record
                const isClusterRecord = hasClusterAnalysis && result.zipCount;
                // For Claude, prioritize full DESCRIPTION over extracted area_name
                const fullDescription = result.properties?.DESCRIPTION || result.DESCRIPTION;
                const resolvedName = (() => {
                  try { return resolveSharedAreaName(result, { mode: 'zipCity', neutralFallback: '' }) || ''; } catch { return ''; }
                })();
                const displayName = resolvedName || fullDescription || result.area_name || result.name || result.area_id || result.id || `Area ${index + 1}`;
                const displayId = result.area_id || result.id;
                
                // Debug what displayName is actually being used
                if (index < 3) {
                  console.log(`🔍 [DISPLAYNAME DEBUG] Record ${index + 1}:`);
                  console.log(`   result.properties?.DESCRIPTION: "${result.properties?.DESCRIPTION}"`);
                  console.log(`   result.DESCRIPTION: "${result.DESCRIPTION}"`);
                  console.log(`   result.area_name: "${result.area_name}"`);
                  console.log(`   fullDescription: "${fullDescription}"`);
                  console.log(`   displayName: "${displayName}"`);
                }
                
                // Generic approach: try to find the score field from the configuration
                // For clusters, use avgScore; for individual records, use the configured field
                const targetValue = isClusterRecord 
                                   ? (result.avgScore || result.value || 0)
                                   : (result.properties?.[scoreFieldName] || 
                                      result[scoreFieldName] || 
                                      result.value || 
                                      0);
                
                console.log(`[Claude Data] ${finalAnalysisResult.endpoint} - using ${scoreFieldName}: ${targetValue} for ${displayName}${isClusterRecord ? ` (${result.zipCount} ZIP codes, avgScore=${result.avgScore})` : ''}`);

                const claudeFeature = {
                  properties: {
                    area_name: displayName,
                    area_id: displayId,
                    target_value: targetValue,
                    target_field: targetPretty,
                    score_field_name: scoreFieldName, // Add the correct score field name for Claude
                    rank: result.rank || 0,
                    analysis_endpoint: finalAnalysisResult.endpoint,
                    total_areas_analyzed: finalAnalysisResult?.data?.records?.length || 0,
                    // Add clustering information if available
                    cluster_id: result.cluster_id || result.id,
                    cluster_name: result.cluster_name || result.name,
                    is_clustered: finalAnalysisResult?.data?.isClustered || false,
                    
                    // Cluster-specific properties when this is a cluster record
                    ...(isClusterRecord ? {
                      zip_count: result.zipCount,
                      avg_score: result.avgScore,
                      max_score: result.maxScore,
                      min_score: result.minScore,
                      total_population: result.totalPopulation,
                      is_cluster_record: true
                    } : {
                      is_cluster_record: false
                    }),
                    
                    // Brand market shares - use cluster aggregated data when available
                    nike_market_share: isClusterRecord && result.marketShares ? result.marketShares.nike : nikeShare,
                    adidas_market_share: isClusterRecord && result.marketShares ? result.marketShares.adidas : adidasShare, 
                    jordan_market_share: isClusterRecord && result.marketShares ? result.marketShares.jordan : jordanShare,
                    market_gap: isClusterRecord && result.marketShares ? result.marketShares.marketGap : Math.max(0, 100 - nikeShare - adidasShare - jordanShare),
                    competitive_advantage: isClusterRecord && result.marketShares ? (result.marketShares.nike - result.marketShares.adidas) : (nikeShare - adidasShare),
                    
                    // Demographics
                    total_population: totalPop,
                    avg_income: avgIncome,
                    median_age: medianAge,
                    
                    // SHAP explanations
                    nike_shap_importance: nikeShap,
                    adidas_shap_importance: adidasShap,
                    top_shap_features: shapFeatures,
                    
                    // Market opportunity metrics
                    opportunity_score: result.value || 0,
                    
                    // CRITICAL: Add endpoint-specific score field for Claude (dynamic based on configuration)
                    [scoreFieldName]: targetValue,
                    
                    // Additional score fields for multi-endpoint compatibility
                    strategic_value_score: scoreFieldName === 'strategic_value_score' ? targetValue : (result.properties?.strategic_value_score || 0),
                    competitive_advantage_score: scoreFieldName === 'competitive_advantage_score' ? targetValue : (result.properties?.competitive_advantage_score || 0),
                    correlation_score: scoreFieldName === 'correlation_score' ? targetValue : (result.properties?.correlation_score || 0),
                    demographic_score: scoreFieldName === 'demographic_score' ? targetValue : (result.properties?.demographic_score || 0),
                    trend_score: scoreFieldName === 'trend_score' ? targetValue : (result.properties?.trend_score || 0),
                    anomaly_score: scoreFieldName === 'anomaly_score' ? targetValue : (result.properties?.anomaly_score || 0),
                    cluster_assignment: scoreFieldName === 'cluster_assignment' ? targetValue : (result.properties?.cluster_assignment || 0),
                    interaction_score: scoreFieldName === 'interaction_score' ? targetValue : (result.properties?.interaction_score || 0),
                    outlier_score: scoreFieldName === 'outlier_score' ? targetValue : (result.properties?.outlier_score || 0),
                    comparison_score: scoreFieldName === 'comparison_score' ? targetValue : (result.properties?.comparison_score || 0),
                    prediction_score: scoreFieldName === 'prediction_score' ? targetValue : (result.properties?.prediction_score || 0),
                    segment_score: scoreFieldName === 'segment_score' ? targetValue : (result.properties?.segment_score || 0),
                    scenario_score: scoreFieldName === 'scenario_score' ? targetValue : (result.properties?.scenario_score || 0),
                    
                    // Additional strategic analysis fields (avoiding duplicates)
                    demographic_opportunity_score: result.properties?.demographic_opportunity_score || 0,
                    median_income: result.properties?.median_income || 0,
                    mp30034a_b_p: result.properties?.mp30034a_b_p || 0,
                    
                    has_shap_data: Object.keys(shapFeatures).length > 0
                  }
                };
                
                // Debug what's actually being sent to Claude for first 5 records
                if (index < 5) {
                  console.log(`[Claude Data] FINAL properties being sent to Claude for record ${index + 1}:`, {
                    area_name_sent: claudeFeature.properties.area_name,
                    area_id_sent: claudeFeature.properties.area_id,
                    rank: claudeFeature.properties.rank,
                    target_value: claudeFeature.properties.target_value,
                    score_field_name: claudeFeature.properties.score_field_name,
                    strategic_value_score: claudeFeature.properties.strategic_value_score,
                    competitive_advantage_score: claudeFeature.properties.competitive_advantage_score,
                    nike_market_share: claudeFeature.properties.nike_market_share,
                    market_gap: claudeFeature.properties.market_gap,
                    demographic_opportunity_score: claudeFeature.properties.demographic_opportunity_score,
                    endpoint: claudeFeature.properties.analysis_endpoint,
                    source_area_name: result.area_name,
                    source_properties_sample: {
                      strategic_value_score: result.properties?.strategic_value_score,
                      competitive_advantage_score: result.properties?.competitive_advantage_score,
                      nike_market_share: result.properties?.nike_market_share,
                      market_gap: result.properties?.market_gap,
                      demographic_opportunity_score: result.properties?.demographic_opportunity_score
                    }
                  });
                }
                
                return claudeFeature;
              });
              })() || [{
                properties: { 
                  area_name: 'No data available', 
                  target_field: targetPretty,
                  total_features: validFeatures.length,
                  analysis_endpoint: analysisResult.endpoint
                }
              }],
              extent: null,
              fields: [targetPretty, 'nike_market_share', 'adidas_market_share', 'opportunity_score', 'shap_features'],
              geometryType: 'polygon'
            }],
            persona: selectedPersona,
        };

        // Debug the complete payload being sent to Claude
        console.log('[Claude API] Complete payload being sent:', {
          query: claudePayload.messages[0].content,
          totalFeatures: claudePayload.featureData[0].features.length,
          firstThreeFeatures: claudePayload.featureData[0].features.slice(0, 3).map((f: any) => ({
            area_name: f.properties.area_name,
            area_id: f.properties.area_id,
            analysis_score: f.properties.target_value
          })),
          metadata: claudePayload.metadata
        });
        
        // Debug cluster analysis content
        if (hasClusterAnalysis && claudePayload.metadata.clusterAnalysis) {
          console.log('🎯 [CLUSTER ANALYSIS DEBUG] Cluster analysis being sent to Claude:');
          console.log('🎯 Length:', claudePayload.metadata.clusterAnalysis.length);
          console.log('🎯 Preview:', claudePayload.metadata.clusterAnalysis.substring(0, 500) + '...');
          console.log('🎯 Contains "Top ZIP codes":', claudePayload.metadata.clusterAnalysis.includes('Top ZIP codes'));
          console.log('🎯 Contains "Strategic Recommendations":', claudePayload.metadata.clusterAnalysis.includes('Strategic Recommendations'));
        } else {
          console.log('❌ [CLUSTER ANALYSIS DEBUG] No cluster analysis in payload!', {
            hasClusterAnalysis,
            hasMetadata: !!claudePayload.metadata,
            clusterAnalysisValue: claudePayload.metadata?.clusterAnalysis
          });
        }
        
        // EXPLICIT DEBUG FOR STRATEGIC ANALYSIS CLAUDE PAYLOAD
        if (query.toLowerCase().includes('strategic')) {
          console.log('🚨🚨🚨 [STRATEGIC CLAUDE DEBUG] What Claude will receive:');
          const strategicFeatures = claudePayload.featureData[0].features.slice(0, 5);
          strategicFeatures.forEach((feature: any, i: number) => {
            const tv = feature.properties.target_value;
            console.log(`🚨🚨🚨   ${i+1}. ${feature.properties.area_name}: target_value=${tv} (type: ${typeof tv}, exact: ${tv === 79.3 ? 'YES 79.3' : 'NO'})`);
            // Check if it's being stored as a float that displays as 79.3
            if (typeof tv === 'number') {
              console.log(`🚨🚨🚨      → Raw number: ${tv}, toFixed(2): ${tv.toFixed(2)}, toFixed(1): ${tv.toFixed(1)}`);
              console.log(`🚨🚨🚨      → JSON.stringify: ${JSON.stringify(tv)}`);
            }
          });
          
          // Check if Claude receives all the same values
          const claudeValues = strategicFeatures.map((f: any) => f.properties.target_value);
          const uniqueClaudeValues = [...new Set(claudeValues)];
          if (uniqueClaudeValues.length === 1) {
            console.log('🚨🚨🚨 ❌ PROBLEM: Claude receives identical target_values!');
            console.log('🚨🚨🚨 All Claude values:', claudeValues);
          } else {
            console.log('🚨🚨🚨 ✅ Claude receives distinct values:', uniqueClaudeValues);
          }
          
          // Also log the exact JSON that will be sent
          console.log('🚨🚨🚨 [STRATEGIC CLAUDE DEBUG] Exact JSON being sent:');
          console.log(JSON.stringify(strategicFeatures.slice(0, 2), null, 2));
        }

        const claudeResp = await fetch('/api/claude/housing-generate-response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(claudePayload),
        });

        if (claudeResp.ok) {
          const claudeJson = await claudeResp.json();
          narrativeContent = claudeJson?.content || null;
          
          // Validate score terminology in Claude's response
          if (narrativeContent) {
            const terminologyValidation = validateScoreTerminology(analysisResult.endpoint, narrativeContent);
            if (!terminologyValidation.isValid) {
              console.warn(`[ScoreValidation] Claude analysis has incorrect terminology for ${analysisResult.endpoint}:`, terminologyValidation.issues);
              console.log(`[ScoreValidation] Expected: ${terminologyValidation.expectedTerms.join(', ')}`);
              console.log(`[ScoreValidation] Found: ${terminologyValidation.foundTerms.join(', ')}`);
            } else {
              console.log(`[ScoreValidation] ✅ Claude analysis uses correct terminology for ${analysisResult.endpoint}`);
            }
            
            // ALSO validate that score explanation is at the beginning
            const explanationValidation = validateScoreExplanationPlacement(analysisResult.endpoint, narrativeContent);
            if (!explanationValidation.hasExplanation) {
              console.warn(`[ScoreExplanation] Claude analysis missing score explanation for ${analysisResult.endpoint}:`, explanationValidation.issues);
            } else if (!explanationValidation.isAtBeginning) {
              console.warn(`[ScoreExplanation] Claude score explanation not at beginning for ${analysisResult.endpoint}:`, explanationValidation.issues);
            } else {
              console.log(`[ScoreExplanation] ✅ Claude explains score calculation at beginning for ${analysisResult.endpoint}`);
            }
          }
        } else {
          console.error('[AnalysisEngine] Claude API failed:', claudeResp.status);
        }
      } catch (err) {
        console.error('[AnalysisEngine] Claude integration failed:', err);
      }

      // Complete narrative generation step
      setProcessingSteps((prev: GeoProcessingStep[]) => prev.map(s => 
        s.id === 'narrative_generation' ? { 
          ...s, 
          status: 'complete', 
          message: narrativeContent ? 'Narrative analysis complete' : 'Analysis complete (using analysis data)' 
        } : s
      ));

      // Create detailed analysis summary if Claude fails - use finalAnalysisResult for clustered data
      const baseFinalContent = narrativeContent || createAnalysisSummary(
        finalAnalysisResult, 
        finalAnalysisResult, 
        validFeatures.length,
        query,
        TARGET_OPTIONS,
        currentTarget
      );
      
      // Check for fallback analysis and add warning message if needed
      const isFallbackAnalysis = (enhancedAnalysisResult as any)?.is_fallback || 
                                 (enhancedAnalysisResult as any)?.status === 'fallback' ||
                                 baseFinalContent?.includes?.('fallback') ||
                                 baseFinalContent?.includes?.('unavailable');
      
      const fallbackWarning = isFallbackAnalysis ? 
        `⚠️ **Limited Analysis Mode**: The full AI analysis service is currently unavailable. This is a simplified analysis using basic data patterns. Please try again later for complete insights with advanced scoring and recommendations.\n\n---\n\n` : '';
      
      const finalContent = fallbackWarning + baseFinalContent;
      
      // Update message with streaming content
      setMessages((prev: LocalChatMessage[]) => prev.map(msg =>
        msg.id === assistantMessageId
          ? { 
              ...msg, 
              content: finalContent, 
              metadata: { 
                ...msg.metadata, 
                analysisResult: finalAnalysisResult,
                isStreaming: true 
              } 
            }
          : msg
      ));

      // Clear progress steps when streaming begins
      setIsProcessing(false);
      setCurrentProcessingStep(null);

      addContextMessage({
        role: 'assistant',
        content: finalContent,
        metadata: { analysisResult: finalAnalysisResult }
      } as ChatMessage);

      await refreshContextSummary();
      
      // CRITICAL FIX: Use FULL data for features context, not visualization-optimized data
      // For clustered data, use individual ZIP records (not cluster summaries) so ZIP zoom works
      const isClusteredData = finalAnalysisResult.data.isClustered && finalAnalysisResult.data.clusters;
      const sourceRecords = finalAnalysisResult.data.records; // Always use individual records for zoom functionality
      
      if (!sourceRecords) {
        console.error('🚨 [DATA SOURCE] No source records available');
        throw new Error('No data records available for analysis');
      }
      
      console.log('🎯 [DATA SOURCE] Using data source for Claude:', {
        isClusteredData,
        usingIndividualRecords: true, // Always use individual records for zoom functionality
        sourceRecordCount: sourceRecords.length,
        sourceType: 'individual_records' // Changed: always individual records, not cluster summaries
      });
      
      // Convert individual records back to GeospatialFeature format for analysis/chat
      const fullDataFeatures = sourceRecords.map((record: any) => ({
        type: 'Feature' as const,
        geometry: record.geometry,
        area_name: record.area_name, // Essential for ZIP code zoom (e.g., "11368 (Corona)")
        cluster_id: record.cluster_id, // Essential for clustered data (e.g., 0, 1, 2, 3, 4)
        cluster_name: record.cluster_name, // For display (e.g., "Corona Territory")
        properties: {
          ...record.properties,
          [finalAnalysisResult.data.targetVariable]: record.value,
          target_value: record.value,
          area_name: record.area_name,
          area_id: record.area_id || record.properties?.ID,
          // Preserve cluster information for clustered data
          ...(isClusteredData ? {
            cluster_id: record.cluster_id,
            cluster_name: record.cluster_name
          } : {})
        }
      }));
      
      console.log('🚨 [FEATURES STORAGE] Using FULL data for analysis context:', {
        fullDataFeaturesLength: fullDataFeatures.length,
        visualizationFeaturesLength: validFeatures.length,
        preservedAllFields: true,
        sampleFullDataFields: fullDataFeatures[0] ? Object.keys(fullDataFeatures[0].properties).length : 0,
        sampleRecord: fullDataFeatures[0] ? {
          [enhancedAnalysisResult.data.targetVariable]: fullDataFeatures[0].properties?.[enhancedAnalysisResult.data.targetVariable],
          value_MP30034A_B_P: fullDataFeatures[0].properties?.value_MP30034A_B_P,
          description: fullDataFeatures[0].properties?.DESCRIPTION,
          totalProperties: Object.keys(fullDataFeatures[0].properties).length
        } : 'No features'
      });
      
      // Use FULL data for analysis/chat context, not visualization-optimized data
      setFeatures(fullDataFeatures as GeospatialFeature[]);

      console.log('[AnalysisEngine] Integration complete');

      // Add multi-endpoint result handling
      handleMultiEndpointResult(analysisResult);
    } catch (error) {
      console.error('[ANALYSIS ENGINE ERROR]', error);
      console.error('[AnalysisEngine] Error during analysis:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setError(errorMessage);
      
      setProcessingSteps((prev: GeoProcessingStep[]) => prev.map(s => {
        if (s.status === 'processing') {
          return { ...s, status: 'error', message: errorMessage };
        }
        if (currentProcessingStep && s.id === currentProcessingStep) {
          return { ...s, status: 'error', message: errorMessage };
        }
        return s;
      }));
      
      // Clear progress steps on error
      setIsProcessing(false);
      setCurrentProcessingStep(null);
      
      setMessages((prev: LocalChatMessage[]) => prev.map(msg =>
        msg.id === assistantMessageId ? {
          ...msg,
          content: `Sorry, I encountered an error while processing your query: ${errorMessage}`,
          metadata: { ...msg.metadata, error: errorMessage, isStreaming: false }
        } : msg
      ));
    } finally {
      // Progress steps are now cleared when streaming begins
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSubmit(inputQuery, 'main');
  };

  // Handle unified workflow completion
  const handleUnifiedAnalysisComplete = useCallback(async (result: UnifiedAnalysisResponse) => {
    console.log('[UnifiedWorkflow] ★★★ handleUnifiedAnalysisComplete CALLED ★★★');
    console.log('[UnifiedWorkflow] Full result structure:', result);
    console.log('[UnifiedWorkflow] Analysis complete:', result);
    console.log('[UnifiedWorkflow] Analysis result data:', {
      hasData: !!result?.analysisResult?.data,
      recordCount: result?.analysisResult?.data?.records?.length || 0,
      firstRecord: result?.analysisResult?.data?.records?.[0],
      dataStructure: result?.analysisResult?.data
    });
    
    // Convert unified result to existing format for compatibility
    const { analysisResult } = result;
    
    console.log('[UnifiedWorkflow] 🚨 CRITICAL DEBUG - analysisResult structure:', {
      hasAnalysisResult: !!analysisResult,
      analysisResultKeys: analysisResult ? Object.keys(analysisResult) : [],
      hasData: !!analysisResult?.data,
      dataKeys: analysisResult?.data ? Object.keys(analysisResult.data) : [],
      hasRecords: !!analysisResult?.data?.records,
      recordsType: typeof analysisResult?.data?.records,
      recordsIsArray: Array.isArray(analysisResult?.data?.records),
      recordCount: analysisResult?.data?.records?.length || 0
    });
    
    // CRITICAL FIX: Perform geometry join process like original UI
    console.log('[UnifiedWorkflow] 🔍 DEBUG: Checking geometry join conditions...', {
      hasAnalysisResult: !!analysisResult,
      hasData: !!analysisResult?.data,
      hasRecords: !!analysisResult?.data?.records,
      recordCount: analysisResult?.data?.records?.length || 0,
      sampleRecord: analysisResult?.data?.records?.[0] ? {
        hasGeometry: !!(analysisResult.data.records[0] as any).geometry,
        areaId: (analysisResult.data.records[0] as any).area_id,
        keys: Object.keys(analysisResult.data.records[0]).slice(0, 10)
      } : null
    });
    
    if (analysisResult.data?.records && analysisResult.data.records.length > 0) {
      console.log('[UnifiedWorkflow] 🔍 DEBUG: Starting geometry join process with', analysisResult.data.records.length, 'records');
      
      try {
        // Load the cached ZIP Code polygon boundaries (same as original UI)
        console.log('[UnifiedWorkflow] 🔍 DEBUG: About to call loadGeographicFeatures...');
        const geographicFeatures = await loadGeographicFeatures();
        console.log('[UnifiedWorkflow] 🔍 DEBUG: loadGeographicFeatures returned:', geographicFeatures.length, 'features');
        
        if (geographicFeatures.length === 0) {
          throw new Error('loadGeographicFeatures returned empty array');
        }
        
        console.log('[UnifiedWorkflow] ✅ ZIP Code boundaries loaded:', {
          count: geographicFeatures.length,
          sampleFeature: geographicFeatures[0] ? {
            hasGeometry: !!geographicFeatures[0].geometry,
            sampleId: geographicFeatures[0].properties?.ID
          } : null
        });
        
        // Join analysis data with ZIP Code polygon boundaries (same logic as original UI)
        console.log('[UnifiedWorkflow] 🔍 DEBUG: Starting record mapping for', analysisResult.data.records.length, 'records');
        
        const joinedResults = analysisResult.data.records.map((record: any, index: number) => {
          // Extract ZIP Code using same logic as original UI
          const recordAreaId = record.area_id;
          const recordPropertiesID = record.properties?.ID;
          const recordPropertiesId = record.properties?.id;
          const recordDirectID = record.ID;
          const recordDirectId = record.id;
          
          // Priority: properties.ID > area_id (unless area_id is numeric) > direct ID fields
          let primaryId = recordPropertiesID || recordPropertiesId || recordDirectID || recordDirectId;
          
          // If area_id is numeric (not area_XXXX pattern), prefer it over fallback fields
          if (recordAreaId && !String(recordAreaId).startsWith('area_')) {
            primaryId = recordAreaId;
          }
          
          const rawZip = String(primaryId || recordAreaId || `area_${index}`);
          
          // Check if this is a Canadian FSA (3 chars: letter-digit-letter) - DO NOT PAD
          const isFSA = /^[A-Z]\d[A-Z]$/i.test(rawZip);
          const recordZip = isFSA ? rawZip.toUpperCase() : rawZip.padStart(5, '0'); // Only pad numeric ZIPs to 5 digits
          
          // Debug logging for first few records
          if (index < 3) {
            console.log(`[UnifiedWorkflow] 🔍 DEBUG: Record ${index} ZIP extraction:`, {
              recordAreaId,
              recordPropertiesID,
              recordDirectID,
              primaryId,
              rawZip,
              recordZip,
              sampleBoundaryIds: geographicFeatures.slice(0, 3).map(f => f?.properties?.ID)
            });
          }
          
          // Find matching boundary by ID (supports both ZIP codes and FSAs)
          const zipFeature = geographicFeatures.find(f => {
            if (!f?.properties) return false;
            
            // For FSAs (3 chars: letter-digit-letter), match without padding
            if (isFSA) {
              return (
                String(f.properties.ID || '').toUpperCase() === recordZip ||
                String(f.properties.FSA_ID || '').toUpperCase() === recordZip ||
                String(f.properties.POSTAL_CODE || '').toUpperCase() === recordZip ||
                // Extract FSA from DESCRIPTION: "G0A (La Sarre)" -> "G0A"
                f.properties.DESCRIPTION?.match(/^([A-Z]\d[A-Z])/i)?.[1]?.toUpperCase() === recordZip
              );
            }
            
            // For US ZIP codes (numeric), use padding for comparison only when both are numeric
            const propID = String(f.properties.ID || '');
            const propZIP = String(f.properties.ZIP || '');
            const propZIPCODE = String(f.properties.ZIPCODE || '');
            const propOBJECTID = String(f.properties.OBJECTID || '');
            
            // Helper function: only pad if both values are numeric (ZIP codes), not FSA codes
            const compareWithConditionalPadding = (boundaryValue: string, recordValue: string) => {
              const isRecordNumeric = /^\d+$/.test(recordValue);
              const isBoundaryNumeric = /^\d+$/.test(boundaryValue);
              
              // If both are numeric (ZIP codes), pad for comparison
              if (isRecordNumeric && isBoundaryNumeric) {
                return boundaryValue.padStart(5, '0') === recordValue.padStart(5, '0');
              }
              // Otherwise, compare as-is (handles FSAs)
              return boundaryValue === recordValue;
            };
            
            return (
              compareWithConditionalPadding(propID, recordZip) ||
              compareWithConditionalPadding(propZIP, recordZip) ||
              compareWithConditionalPadding(propZIPCODE, recordZip) ||
              // Extract ZIP from DESCRIPTION: "08837 (Edison)" -> "08837"
              f.properties.DESCRIPTION?.match(/^(\d{5})/)?.[1] === recordZip ||
              compareWithConditionalPadding(propOBJECTID, recordZip)
            );
          });
          
          // Debug logging for geometry matches
          if (index < 3) {
            console.log(`[UnifiedWorkflow] 🔍 DEBUG: Record ${index} geometry match:`, {
              recordZip,
              foundMatch: !!zipFeature,
              zipFeatureId: zipFeature?.properties?.ID,
              hasGeometry: !!zipFeature?.geometry
            });
          }
          
          // Create record with actual ZIP Code polygon geometry
          if (zipFeature) {
            const zipDescription = zipFeature.properties?.DESCRIPTION || '';
            const zipMatch = zipDescription.match(/^(\d{5})\s*\(([^)]+)\)/);
            const zipCode = zipMatch?.[1] || recordZip;
            const cityName = zipMatch?.[2] || 'Unknown City';
            
            return {
              ...record,
              geometry: zipFeature.geometry,
              area_name: `${zipCode} (${cityName})`,
              properties: {
                ...record.properties,
                ID: zipCode,
                ZIP: zipCode,
                city: cityName,
                DESCRIPTION: zipDescription,
              }
            };
          } else {
            // No geometry match found
            console.warn(`[UnifiedWorkflow] No geometry found for ZIP: ${recordZip}`);
            return {
              ...record,
              geometry: null
            };
          }
        });
        
        // Update analysis result with joined data (same as original UI)
        console.log('[UnifiedWorkflow] 🔍 BEFORE geometry join - checking renderer/legend:');
        console.log('[UnifiedWorkflow] Has renderer:', !!analysisResult.data.renderer);
        console.log('[UnifiedWorkflow] Has legend:', !!analysisResult.data.legend);
  console.log('[UnifiedWorkflow] Legend title:', (analysisResult.data.legend as any)?.title);
  console.log('[UnifiedWorkflow] Legend items:', ((analysisResult.data.legend as any)?.items as any[])?.length);
        
        analysisResult.data = {
          ...analysisResult.data,
          records: joinedResults
        };
        
        console.log('[UnifiedWorkflow] 🔍 AFTER geometry join - checking renderer/legend:');
        console.log('[UnifiedWorkflow] Has renderer:', !!analysisResult.data.renderer);
        console.log('[UnifiedWorkflow] Has legend:', !!analysisResult.data.legend);
  console.log('[UnifiedWorkflow] Legend title:', (analysisResult.data.legend as any)?.title);
  console.log('[UnifiedWorkflow] Legend items:', ((analysisResult.data.legend as any)?.items as any[])?.length);
        
        console.log('[UnifiedWorkflow] 🔍 CHECKING VISUALIZATION OBJECT:');
        console.log('[UnifiedWorkflow] Visualization has legend:', !!analysisResult.visualization?.legend);
  console.log('[UnifiedWorkflow] Visualization legend title:', (analysisResult.visualization as any)?.legend?.title);
        
        const recordsWithGeometry = joinedResults.filter(r => r.geometry).length;
        const recordsWithoutGeometry = joinedResults.length - recordsWithGeometry;
        
        console.log('[UnifiedWorkflow] ✅ Geometry join complete:', {
          totalRecords: joinedResults.length,
          recordsWithGeometry,
          recordsWithoutGeometry,
          successRate: `${((recordsWithGeometry / joinedResults.length) * 100).toFixed(1)}%`,
          sampleRecordWithGeometry: joinedResults.find(r => r.geometry) ? {
            areaId: joinedResults.find(r => r.geometry)?.area_id,
            hasGeometry: !!joinedResults.find(r => r.geometry)?.geometry,
            geometryType: joinedResults.find(r => r.geometry)?.geometry?.type
          } : 'No records with geometry found'
        });
        
        // CRITICAL: Log if no geometries were successfully joined
        if (recordsWithGeometry === 0) {
          console.error('[UnifiedWorkflow] ❌ CRITICAL: NO GEOMETRIES JOINED! This will cause visualization failure.');
          console.error('[UnifiedWorkflow] Sample boundary feature structure:', {
            boundaryCount: geographicFeatures.length,
            sampleBoundary: geographicFeatures[0] ? {
              hasProperties: !!geographicFeatures[0].properties,
              propertyKeys: geographicFeatures[0].properties ? Object.keys(geographicFeatures[0].properties) : [],
              sampleId: geographicFeatures[0].properties?.ID,
              hasGeometry: !!geographicFeatures[0].geometry
            } : 'No boundary features'
          });
          console.error('[UnifiedWorkflow] Sample analysis record structure:', {
            recordCount: analysisResult.data.records.length,
            sampleRecord: analysisResult.data.records[0] ? {
              hasAreaId: !!(analysisResult.data.records[0] as any).area_id,
              areaId: (analysisResult.data.records[0] as any).area_id,
              hasID: !!(analysisResult.data.records[0] as any).ID,
              ID: (analysisResult.data.records[0] as any).ID,
              allKeys: Object.keys(analysisResult.data.records[0]).slice(0, 15)
            } : 'No analysis records'
          });
        }
        
      } catch (error) {
        console.error('[UnifiedWorkflow] ❌ Geometry join failed:', error);
        // Continue without geometry data if join fails
      }
    } else {
      console.warn('[UnifiedWorkflow] ⚠️ Skipping geometry join - conditions not met:', {
        hasAnalysisResult: !!analysisResult,
        hasData: !!analysisResult?.data,
        hasRecords: !!analysisResult?.data?.records,
        recordCount: analysisResult?.data?.records?.length || 0
      });
    }
    
    // Update features for chat context (after geometry join)
    if (analysisResult.data?.records) {
      const features = analysisResult.data.records.map((record, index) => ({
        ...record,
        id: record.area_id || `feature_${index}`,
        geometry: record.geometry || null
      }));
      
      onFeaturesFound(features);
      console.log(`[UnifiedWorkflow] Updated features: ${features.length} records`);
    }
    
    // Apply visualization to map using existing logic (now with geometry data)
    if (analysisResult.visualization && analysisResult.data && initialMapView) {
      try {
        console.log('[UnifiedWorkflow] Applying visualization to map...');
        
        // Use the existing applyAnalysisEngineVisualization function
        const visualizationLayer = await applyAnalysisEngineVisualization(
          analysisResult.visualization,
          analysisResult.data,
          initialMapView,
          setFormattedLegendData,
          undefined,
          { callerId: 'geospatial-chat-interface' }
        );
        
        if (visualizationLayer) {
          console.log('[UnifiedWorkflow] ✅ Visualization applied successfully');
          
          // CRITICAL FIX: Call onVisualizationLayerCreated to trigger CustomPopupManager
          console.log('[UnifiedWorkflow] Calling onVisualizationLayerCreated for CustomPopupManager integration');
          onVisualizationLayerCreated(visualizationLayer, true);
          
          // Zoom to features if requested
          if (analysisResult.data.shouldZoom && analysisResult.data.extent) {
            initialMapView.goTo(analysisResult.data.extent);
          }
        } else {
          console.warn('[UnifiedWorkflow] ⚠️ Visualization layer not created');
        }
      } catch (error) {
        console.error('[UnifiedWorkflow] ❌ Failed to apply visualization:', error);
      }
    }
    
    // Keep user in unified workflow after analysis completion
    // setShowUnifiedWorkflow(false);  // Keep workflow visible
    // setInputMode('chat');  // Stay in analysis mode
    
  }, [onFeaturesFound, initialMapView]);

  const handleShowUnifiedWorkflow = useCallback(() => {
    setShowUnifiedWorkflow(true);
    setInputMode('analysis');
  }, []);

  // --- Plain conversational chat ---

  // 🎯 AUTO-ZOOM: Helper methods for automatic map zooming
  const shouldAutoZoomToFeatures = (data: any, features: any[]): boolean => {
    // Only auto-zoom if we have a reasonable subset of features (not showing everything)
    const totalPossibleFeatures = 3983; // Approximate total ZIP codes in dataset
    const displayedFeatures = features.length;
    const percentageShown = displayedFeatures / totalPossibleFeatures;
    
    // Check if this is a query type that should trigger auto-zoom
    const currentQuery = inputQuery.toLowerCase();
    const isComparativeQuery = currentQuery.includes('compare') || currentQuery.includes('vs') || currentQuery.includes('versus');
    const isRankingQuery = currentQuery.includes('top ') || currentQuery.includes('best ') || currentQuery.includes('highest ') || currentQuery.includes('lowest ');
    const isCityQuery = currentQuery.includes(' nyc') || currentQuery.includes('new york') || currentQuery.includes('philadelphia') || currentQuery.includes('chicago') || currentQuery.includes('boston');
    
    // Auto-zoom conditions:
    // 1. Showing less than 20% of total features (for comparative, ranking, etc.)
    // 2. OR it's a specific query type that focuses on limited areas
    const shouldZoomByPercentage = percentageShown < 0.20;
    const shouldZoomByQueryType = isComparativeQuery || isRankingQuery || isCityQuery;
    const shouldZoom = shouldZoomByPercentage || shouldZoomByQueryType;
    
    console.log('[AutoZoom] Zoom decision:', {
      displayedFeatures,
      totalPossibleFeatures,
      percentageShown: (percentageShown * 100).toFixed(1) + '%',
      isComparativeQuery,
      isRankingQuery,
      isCityQuery,
      shouldZoomByPercentage,
      shouldZoomByQueryType,
      shouldZoom
    });
    
    return shouldZoom;
  };

  const zoomToDisplayedFeatures = async (mapView: any, featureLayer: any, _features: any[]) => {
    try {
      // Wait for layer to be fully loaded
      if (!featureLayer.loaded) {
        await featureLayer.load();
      }
      
      // Wait for map view to be ready
      await mapView.when();
      
      // Use a slight delay to ensure features are rendered
      setTimeout(async () => {
        try {
          // Get the full extent of the feature layer
          const fullExtent = await featureLayer.queryExtent();
          
          if (fullExtent.extent) {
            console.log('[AutoZoom] Zooming to feature extent:', {
              xmin: fullExtent.extent.xmin,
              ymin: fullExtent.extent.ymin,
              xmax: fullExtent.extent.xmax,
              ymax: fullExtent.extent.ymax
            });
            
            // Zoom to the extent with some padding
            await mapView.goTo(fullExtent.extent.expand(1.2), {
              duration: 1500, // Smooth animation
              easing: 'ease-in-out'
            });
          }
        } catch (zoomError) {
          console.warn('[AutoZoom] Failed to zoom to features:', zoomError);
        }
      }, 1000); // Give layer time to render
      
    } catch (error) {
      console.warn('[AutoZoom] Error in zoom to features:', error);
    }
  };

  // Message dialog component
  const MessageDialog: React.FC<{ message: LocalChatMessage | null; onClose: () => void }> = ({ message, onClose }) => {
    if (!message) return null;

    return (
      <Dialog open={!!message} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto theme-bg-primary" aria-describedby="analysis-details-description">
          <DialogHeader>
            <DialogTitle>Analysis Details</DialogTitle>
          </DialogHeader>
          <div id="analysis-details-description" className="space-y-4">
            <div>
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
            {message.metadata?.analysisResult && (
              <div>
                {/* Dynamic Model Performance Information */}
                {renderPerformanceMetrics(
                  message.metadata.analysisResult,
                  "flex flex-wrap gap-4 mt-2 text-sm text-gray-700"
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  };
  
  // Before rendering the Infographics side panel
  console.log('[GeospatialChat] isInfographicsOpen:', isInfographicsOpen);

  const handleVisualizationUpdate = async (messageId: string, options: any) => {
    const message = messages.find(m => m.id === messageId);
    if (!message || !message.metadata?.analysisResult) {
      toast({ title: "Update Failed", description: "Original analysis data not found.", variant: "destructive" });
      return;
    }
  
    // Retrieve original features directly from the message's metadata
    // This relies on the handleSubmit function storing the features used for the *initial* visualization
    const originalFeatures = (message.metadata.debugInfo?.features as GeospatialFeature[]) || [];
  
    if (!originalFeatures || originalFeatures.length === 0) {
      toast({ title: "Update Failed", description: "No features available to re-visualize.", variant: "destructive" });
      return;
    }
  
    try {
      const originalAnalysisResult = message.metadata.analysisResult;

      const visualizationFactory = new VisualizationFactory({
        analysisResult: originalAnalysisResult,
        enhancedAnalysis: originalAnalysisResult,
        features: { features: originalFeatures }
      });
      
      const layerResultForViz = [{ layerId: dataSource.layerId, layerName: 'Analysis Results', features: originalFeatures }];
      
      const newVisualizationResult = await visualizationFactory.createVisualization(layerResultForViz, {
        ...options,
        title: originalAnalysisResult.query, 
      });
  
      if (!newVisualizationResult || !newVisualizationResult.layer) throw new Error('Failed to create updated visualization layer.');
  
      if (currentVisualizationLayer.current && currentMapView && currentMapView.map) {
        try {
          currentMapView.map.remove(currentVisualizationLayer.current);
        } catch (error) {
          console.warn('[GeospatialChat] Error removing visualization layer:', error);
        }
      }
      onVisualizationLayerCreated(newVisualizationResult.layer, true);
      currentVisualizationLayer.current = newVisualizationResult.layer;
  
      setVisualizationResult(newVisualizationResult as ChatVisualizationResult);
      if (newVisualizationResult.legendInfo) setFormattedLegendData(newVisualizationResult.legendInfo);
  
      toast({ title: "Visualization Updated", description: `Switched to ${options.visualizationMode || 'new'} view.` });

      // --- Refresh narrative analysis ---
      try {
        const processedLayersForClaude = [{
          layerId: dataSource.layerId,
          layerName: 'Analysis Results',
          layerType: 'polygon',
          layer: {
            id: dataSource.layerId,
            name: 'Analysis Results',
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
          },
          features: originalFeatures,
          extent: null,
          fields: [],
          geometryType: 'polygon'
        }];

        // Map visualization type to analysisType if available
        const vizTypeToAnalysis: Record<string, string> = {
          correlation: 'correlation',
          ranking: 'ranking',
          distribution: 'single_layer',
        };

        const claudeResp = await fetch('/api/claude/housing-generate-response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: message.content }],
            metadata: {
              query: message.content,
              analysisType: lastAnalysisEndpoint ? lastAnalysisEndpoint.replace('/', '').replace(/-/g, '_') : (originalAnalysisResult.queryType || vizTypeToAnalysis[options.type] || 'single_layer'),
              relevantLayers: [dataSource.layerId],
              clusterOptions: options.clusters ?? undefined,
            },
            featureData: processedLayersForClaude,
            persona: selectedPersona, // Add selected persona
          }),
        });

        if (claudeResp.ok) {
          const claudeJson = await claudeResp.json();
          const newContent = claudeJson?.content;
          if (newContent) {
            setMessages((prev: LocalChatMessage[]) => prev.map(m => m.id === messageId ? { 
            ...m, 
            content: newContent,
            metadata: { ...m.metadata, isStreaming: false }
          } : m));
          }
        }
      } catch (refreshErr) {
        console.warn('[VisualizationUpdate] Failed to refresh analysis narrative:', refreshErr);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
      toast({ title: "Update Failed", description: errorMessage, variant: "destructive" });
    } finally {
      setIsVizPanelOpen(false);
    }
  };

  const [inputMode, setInputMode] = useState<'analysis' | 'chat'>('analysis');
  const [showChatNudge, setShowChatNudge] = useState(false);
  const [shapChartData, setSHAPChartData] = useState<Array<{name: string, value: number}>>([]);
  const [shapChartOpen, setSHAPChartOpen] = useState(false);
  const [shapAnalysisType, setSHAPAnalysisType] = useState<string>('');
  
  // Clustering state
  const [clusterConfig, setClusterConfig] = useState<ClusterConfig>({
    ...DEFAULT_CLUSTER_CONFIG,
    minScorePercentile: DEFAULT_CLUSTER_CONFIG.minScorePercentile ?? 70
  });
  const [clusterDialogOpen, setClusterDialogOpen] = useState(false);
  
  // Monitor lastAnalysisEndpoint changes for clustering button state
  useEffect(() => {
    if (lastAnalysisEndpoint) {
      const isSupported = ['/strategic-analysis', '/demographic-insights'].includes(lastAnalysisEndpoint);
      console.log(`[CLUSTERING] Endpoint changed to ${lastAnalysisEndpoint} - clustering ${isSupported ? 'enabled' : 'disabled'}`);
    }
  }, [lastAnalysisEndpoint]);

  // Function to detect query type based on current input
  const detectQueryEndpoint = (query: string): string | null => {
    if (!query || query.trim().length === 0) return null;
    
    const lowerQuery = query.toLowerCase();
    
    // Brand comparison detection
    if (lowerQuery.includes(' vs ') || lowerQuery.includes(' versus ') || 
        (lowerQuery.includes('difference') && (lowerQuery.includes('nike') || lowerQuery.includes('adidas') || 
         lowerQuery.includes('brand') || lowerQuery.includes('market share')))) {
      return '/brand-difference';
    }
    
    // Comparative analysis detection (geographic area comparisons)
    if (lowerQuery.includes('compare') && (
        lowerQuery.includes('between') || lowerQuery.includes('performance') ||
        lowerQuery.includes('brooklyn') || lowerQuery.includes('philadelphia') ||
        lowerQuery.includes('area') || lowerQuery.includes('region')
    )) {
      return '/comparative-analysis';
    }
    
    // Competitive analysis detection (business competition)
    if (lowerQuery.includes('competitor') || lowerQuery.includes('competitive') || 
        lowerQuery.includes('competition')) {
      return '/competitive-analysis';
    }
    
    // Strategic analysis detection (clustering supported)
    if (lowerQuery.includes('where should') || lowerQuery.includes('expansion') || 
        lowerQuery.includes('strategic') || lowerQuery.includes('market opportunity')) {
      return '/strategic-analysis';
    }
    
    // Demographic insights detection (clustering supported)  
    if (lowerQuery.includes('demographic') || lowerQuery.includes('age') || 
        lowerQuery.includes('income') || lowerQuery.includes('population')) {
      return '/demographic-insights';
    }
    
    return null;
  };

  // Calculate clustering button state
  const clusteringButtonState = useMemo(() => {
    const supportsClusteringEndpoints = ['/strategic-analysis', '/demographic-insights', '/comparative-analysis'];
    let clusteringSupported = true;
    let disabledReason = '';
    
    if (selectedEndpoint !== 'auto') {
      // Manual endpoint selection
      const selectedEndpointPath = `/${selectedEndpoint}`;
      clusteringSupported = supportsClusteringEndpoints.includes(selectedEndpointPath);
      if (!clusteringSupported) {
        disabledReason = `Clustering not supported for ${selectedEndpoint.replace(/-/g, ' ')} analysis`;
      }
    } else {
      // Auto mode - check current query first, then fall back to last analysis
      const currentQueryEndpoint = detectQueryEndpoint(inputQuery);
      
      if (currentQueryEndpoint) {
        // Current query suggests a specific endpoint
        clusteringSupported = supportsClusteringEndpoints.includes(currentQueryEndpoint);
        if (!clusteringSupported) {
          const endpointName = currentQueryEndpoint.replace('/', '').replace(/-/g, ' ');
          disabledReason = `Clustering not supported for ${endpointName} analysis`;
        }
      } else if (lastAnalysisEndpoint) {
        // No current query detected, use last analysis endpoint
        clusteringSupported = supportsClusteringEndpoints.includes(lastAnalysisEndpoint);
        if (!clusteringSupported) {
          const endpointName = lastAnalysisEndpoint.replace('/', '').replace(/-/g, ' ');
          disabledReason = `Clustering not supported for ${endpointName} analysis (last used)`;
        }
      }
      // If no query and no history, keep enabled (default)
    }
    
    return { clusteringSupported, disabledReason };
  }, [selectedEndpoint, lastAnalysisEndpoint, inputQuery]);

  // Show gentle nudge to try chat mode after successful analysis
  useEffect(() => {
    if (features.length > 0 && lastAnalysisEndpoint && inputMode === 'analysis' && !isProcessing) {
      // Show nudge after 3 seconds, hide after 10 seconds
      const showTimer = setTimeout(() => {
        setShowChatNudge(true);
      }, 3000);
      
      const hideTimer = setTimeout(() => {
        setShowChatNudge(false);
      }, 13000);
      
      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [features.length, lastAnalysisEndpoint, isProcessing]);
  
  // Hide nudge when user switches to chat mode
  useEffect(() => {
    if (inputMode === 'chat') {
      setShowChatNudge(false);
    }
  }, [inputMode]);

  // Reset manual override whenever the user enters a completely new query
  const lastQueryRef = useRef<string>('');
  useEffect(() => {
    if (manualTargetOverride && inputQuery !== lastQueryRef.current) {
      setManualTargetOverride(false);
    }
    lastQueryRef.current = inputQuery;
  }, [inputQuery, manualTargetOverride]);

  // Dynamic field name resolution - handles multiple dataset formats

  // Add multi-endpoint result handling
  const handleMultiEndpointResult = (result: any) => {
    if (result.metadata?.isMultiEndpoint) {
      console.log('🔄 Multi-endpoint analysis result:', {
        endpoints: result.metadata.endpointsUsed,
        strategy: result.metadata.mergeStrategy,
        records: result.metadata.dataPointCount,
        insights: result.metadata.strategicInsights?.topOpportunities?.length || 0
      });

      // Update UI to show multi-endpoint specific information
      setMessages((prev: LocalChatMessage[]) => [...prev, {
        id: Date.now().toString(),
        type: 'multi_endpoint_result',
        role: 'assistant',
        content: JSON.stringify(result),
        timestamp: new Date()
      }]);
    }
  };





  return (
  <div className="flex flex-col h-full">
    {/* Message area - Hidden when using unified workflow */}
    {inputMode === 'chat' && (
    <div className="flex-1 min-h-0 overflow-hidden">
      <MessageList
        messages={messages}
        isProcessing={isProcessing}
        processingSteps={processingSteps}
        messagesEndRef={messagesEndRef}
        onMessageClick={handleMessageClick}
        onCopyText={handleCopyText}
        onExportData={handleExportData}
        onSHAPChart={handleSHAPChart}
        onInfographicsClick={handleInfographicsClick}
        onReplyClick={(messageId) => {
          setReplyToMessageId(messageId);
          setReplyInput('');
                                        setIsReplyDialogOpen(true);
                                      }}
        onCustomizeVisualization={handleCustomizeVisualization}
        onZoomToFeature={handleZoomToFeature}
      />
    </div>
    )}

    {/* Input Section - full height container */}
    <div className="flex-1 overflow-hidden min-h-0">
      <div className="h-full theme-bg-primary">

        {/* Chat Nudge Notification */}
        {showChatNudge && inputMode === 'analysis' && (
          <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg animate-fade-in">
            <div className="flex items-start gap-2">
              <MessageCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 text-xs">
                <div className="font-medium text-green-800">💬 Ask questions about your results!</div>
                <button
                  onClick={() => setInputMode('chat')}
                  className="mt-2 text-xs px-2 py-1 bg-[#33a852] text-white rounded hover:bg-[#2d9748] transition-colors"
                >
                  Try it now →
                </button>
              </div>
              <button
                onClick={() => setShowChatNudge(false)}
                className="text-green-400 hover:text-green-600 text-xs flex-shrink-0"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Mode Toggle - Hidden in unified workflow */}
        {false && (
        <div className="mb-3 space-y-2">
          {/* Mode Toggle */}
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setInputMode('analysis')}
              className={`flex-1 px-3 py-1 rounded-md border transition-all ${
                inputMode === 'analysis' 
                  ? 'bg-[#33a852] text-white border-[#33a852] shadow-sm' 
                  : 'bg-gray-50 hover:theme-bg-tertiary border-gray-200'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <BarChart className="w-4 h-4" />
                <span className="font-medium text-xs">New Analysis</span>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setInputMode('chat')}
              className={`flex-1 px-3 py-1 rounded-md border transition-all ${
                (!features.length && !lastAnalysisEndpoint) 
                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                  : inputMode === 'chat' 
                    ? 'bg-[#33a852] text-white border-[#33a852] shadow-sm' 
                    : 'bg-gray-50 hover:theme-bg-tertiary border-gray-200'
              }`}
              disabled={!features.length && !lastAnalysisEndpoint}
            >
              <div className="flex items-center justify-center gap-2">
                <MessageCircle className="w-4 h-4" />
                <span className="font-medium text-xs">Ask Questions</span>
              </div>
            </button>
          </div>
          
        </div>
        )}

        {false && inputMode === 'analysis' && !showUnifiedWorkflow && (
          <div className="flex flex-col gap-4">
            {/* Toggle to Unified Workflow */}
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-blue-900">New: Guided Analysis Workflow</h3>
                  <p className="text-xs text-blue-700">Start with area selection, then choose your analysis type</p>
                </div>
                <Button
                  onClick={handleShowUnifiedWorkflow}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Try New Workflow
                </Button>
              </div>
            </div>
          
            <form onSubmit={handleFormSubmit} className="flex flex-col">
            <div className="flex-1">
              <div className="flex flex-col gap-4 mb-4 pt-0">
                {/* Main Container */}
                <div className="theme-bg-secondary p-2 rounded-lg space-y-2">
                  {/* Title */}
                  <div className="flex items-center gap-2">
                    <Image
                      src="/mpiq_pin2.png"
                      alt="IQbuilder"
                      width={14}
                      height={14}
                      className="object-contain"
                    />
                    <h2 className="text-xs font-semibold">
                      <span>
                        <span className='font-bold text-[#33a852]'>IQ</span>
                        <span className="theme-text-primary">builder</span>
                      </span>
                    </h2>
                    {contextSummary && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700">
                              <MessageCircle className="h-3 w-3" />
                              <span>Context-Aware</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="theme-bg-primary max-w-md">
                            <p className="text-xs">{contextSummary}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              AI responses are aware of your conversation history
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>

                  {/* Buttons Row */}
                  {/* Row 1: Quickstart & Infograph */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {/* Quickstart button */}
                    <Dialog open={quickstartDialogOpen} onOpenChange={setQuickstartDialogOpen}>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DialogTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="relative flex items-center justify-center gap-2 text-xs font-medium border-2 hover:theme-bg-tertiary hover:theme-text-primary hover:theme-border shadow-sm hover:shadow rounded-lg w-full h-7"
                              >
                                <Image
                                  src="/mpiq_pin2.png"
                                  alt="quickstartIQ"
                                  width={16}
                                  height={16}
                                  className="object-contain"
                                />
                                <span>
                                  <span className="text-black">quickstart</span>
                                  <span className='font-bold text-[#33a852]'>IQ</span>
                                </span>
                              </Button>
                            </DialogTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="theme-bg-primary">
                            <p>Choose a query</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <DialogContent className="max-w-2xl min-h-[60vh] max-h-[80vh] overflow-y-auto theme-bg-primary rounded-xl shadow-lg" aria-describedby="query-dialog-description">
                        <QueryDialog
                          onQuestionSelect={(question) => {
                                      // Check if we have existing analysis context - if so, treat as chat
                                      const hasExistingContext = features.length > 0 || currentVisualizationLayer.current;
                                      console.log('[QueryDialog] Processing predefined question:', {
                                        question,
                                        hasExistingContext,
                                        featuresCount: features.length,
                                        hasVisualization: !!currentVisualizationLayer.current
                                      });
                                      
                                      if (hasExistingContext) {
                                        // Treat as contextual chat using existing analysis
                                        console.log('[QueryDialog] → Routing to contextual chat (preserving current analysis)');
                                        handleSubmit(question, 'reply');
                                      } else {
                                        // No existing context, treat as new analysis
                                        console.log('[QueryDialog] → Routing to new analysis (no existing context)');
                                        setInputQuery(question);
                                      }
                                      setQuickstartDialogOpen(false);
                                    }}
                          title="quickstartIQ"
                          description="Choose from predefined demographic and analysis queries to get started quickly."
                          categories={ANALYSIS_CATEGORIES}
                          disabledCategories={{}} // All categories now enabled
                        />
                      </DialogContent>
                    </Dialog>

                    {/* Infographics button - HIDDEN */}
                    {
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="relative flex items-center justify-center gap-2 text-xs font-medium border-2 hover:theme-bg-tertiary hover:theme-text-primary hover:theme-border shadow-sm hover:shadow rounded-lg w-full h-7"
                            onClick={handleInfographicsClick}
                          >
                            <Image
                              src="/mpiq_pin2.png"
                              alt="infographIQ"
                              width={16}
                              height={16}
                              className="object-contain"
                            />
                            <span>
                              <span className="text-black">infograph</span>
                              <span className='font-bold text-[#33a852]'>IQ</span>
                            </span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="theme-bg-primary">
                          <p>Create an infographic</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    }
                  </div>

                  {/* Row 2: Target & Persona */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Target selector button - COMMENTED OUT FOR LATER USE */}
                    {/* <Dialog open={isTargetDialogOpen} onOpenChange={setIsTargetDialogOpen}>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DialogTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="relative flex items-center justify-center gap-1 text-xs font-medium border-2 hover:theme-bg-tertiary hover:theme-text-primary hover:theme-border shadow-sm hover:shadow rounded-lg w-full h-7"
                                onClick={() => setIsTargetDialogOpen(true)}
                              >
                                {React.createElement(
                                  targetIcon,
                                  { className: 'h-3 w-3 mr-1' }
                                )}
                                <span className="truncate">
                                  {TARGET_OPTIONS.find(o => o.value === currentTarget)?.label || 'Nike'}
                                </span>
                              </Button>
                            </DialogTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="theme-bg-primary">
                            <p>Select model target variable</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <DialogContent className="max-w-lg theme-bg-primary">
                        <DialogHeader>
                          <DialogTitle>Select Target Variable</DialogTitle>
                          <p className="text-xs text-gray-600 mt-2">
                            The target variable is the primary metric the
                            analysis will explain.
                          </p>
                        </DialogHeader>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {TARGET_OPTIONS.map((opt) => {
                            const isAvailable = availableTargetOptions.some((availOpt) => availOpt.value === opt.value);
                             return (
                             <Button
                               key={opt.value}
                               variant={currentTarget === opt.value ? 'default' : 'outline'}
                               size="sm"
                               className={`flex flex-col items-start text-left gap-0.5 p-2 h-auto w-full whitespace-normal ${
                                 !isAvailable ? 'opacity-50 cursor-not-allowed' : ''
                               }`}
                               disabled={!isAvailable}
                               onClick={() => {
                                 if (isAvailable) {
                                   setCurrentTarget(opt.value);
                                   const brandIcon = BRAND_ICON_MAP[opt.label] || SiNike;
                                   setTargetIcon(() => brandIcon);
                                   setIsTargetDialogOpen(false);
                                   setManualTargetOverride(true);
                                 }
                               }}
                             >
                               <span className="flex items-center gap-1">
                                 {React.createElement(
                                   BRAND_ICON_MAP[opt.label] || ShoppingCart,
                                   { className: 'h-3 w-3' }
                                 )}
                                 <span className="text-xs font-medium">{opt.label}</span>
                               </span>
                               <span className="text-[10px] leading-tight text-gray-500">
                                 {isAvailable ? `Bought ${opt.label} in Last 12 Months` : 'Not available in current query'}
                               </span>
                             </Button>
                           );
                         })}
                         </div>
                       </DialogContent>
                    </Dialog> */}

                    {/* Persona selector button */}
                    <Dialog open={isPersonaDialogOpen} onOpenChange={setIsPersonaDialogOpen}>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DialogTrigger asChild>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="relative flex items-center justify-center gap-1 text-xs font-medium border-2 hover:theme-bg-tertiary hover:theme-text-primary hover:theme-border shadow-sm hover:shadow rounded-lg w-full h-7"
                              >
                                {React.createElement(
                                  PERSONA_ICON_MAP[selectedPersona] || UserCog,
                                  { className: 'h-3 w-3 mr-1' }
                                )}
                                <span className="truncate">
                                  {personaMetadata.find(p => p.id === selectedPersona)?.name || 'Strategist'}
                                </span>
                              </Button>
                            </DialogTrigger>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="theme-bg-primary">
                            <p>Select AI persona: {personaMetadata.find(p => p.id === selectedPersona)?.name || 'Strategist'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <DialogContent className="max-w-lg theme-bg-primary" aria-describedby="persona-dialog-description">
                        <DialogHeader>
                          <DialogTitle>Select AI Persona</DialogTitle>
                          <p id="persona-dialog-description" className="text-xs text-gray-600 mt-2">
                            Choose an analytical perspective that matches your decision-making context.
                          </p>
                        </DialogHeader>
                        <div className="grid grid-cols-1 gap-3 mt-4">
                          {personaMetadata.map((persona) => (
                            <Button
                              key={persona.id}
                              variant={selectedPersona === persona.id ? 'default' : 'outline'}
                              size="sm"
                              className="flex items-start gap-3 p-4 h-auto text-left justify-start w-full whitespace-normal"
                              onClick={() => {
                                setSelectedPersona(persona.id);
                                setIsPersonaDialogOpen(false);
                              }}
                            >
                              {React.createElement(
                                PERSONA_ICON_MAP[persona.id] || UserCog,
                                { className: 'h-4 w-4 flex-shrink-0 mt-0.5 text-[#33a852]' }
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-xs">{persona.name}</div>
                                <div className="text-xs text-gray-600 mt-1 leading-relaxed">
                                  {persona.description}
                                </div>
                              </div>
                            </Button>
                          ))}
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Cluster Configuration button */}
                    {(() => {
                      // Use the memoized clustering state
                      const { clusteringSupported, disabledReason } = clusteringButtonState;
                      
                      
                      return (
                        <Dialog open={clusterDialogOpen} onOpenChange={setClusterDialogOpen}>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <DialogTrigger asChild disabled={!clusteringSupported}>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={!clusteringSupported}
                                    className={`relative flex items-center justify-center gap-1 text-xs font-medium border-2 shadow-sm rounded-lg w-full h-7 ${
                                      clusteringSupported 
                                        ? 'hover:theme-bg-tertiary hover:theme-text-primary hover:theme-border hover:shadow' 
                                        : 'opacity-50 cursor-not-allowed bg-gray-100 text-gray-400 border-gray-300'
                                    }`}
                                  >
                                    <Target className={`h-3 w-3 mr-1 ${!clusteringSupported ? 'text-gray-400' : ''}`} />
                                    <span className="truncate">
                                      {clusterConfig.enabled ? `${clusterConfig.numClusters} Clusters` : 'Clustering'}
                                    </span>
                                  </Button>
                                </DialogTrigger>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="theme-bg-primary">
                                <p>
                                  {clusteringSupported 
                                    ? 'Configure clustering for territory analysis'
                                    : disabledReason || 'Clustering not available for this analysis type'
                                  }
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto theme-bg-primary" aria-describedby="cluster-dialog-description">
                            <DialogHeader>
                              <DialogTitle>Clustering Configuration</DialogTitle>
                              <p id="cluster-dialog-description" className="text-xs text-gray-600 mt-2">Configure clustering settings for your analysis.</p>
                            </DialogHeader>
                            <ClusterConfigPanel
                              config={clusterConfig}
                              onConfigChange={setClusterConfig}
                              onSave={() => setClusterDialogOpen(false)}
                              className="border-0 shadow-none"
                            />
                          </DialogContent>
                        </Dialog>
                      );
                    })()}
                  </div>

                  {/* Filters summary chip */}
                  {/* TEMPORARILY HIDDEN - FILTERING DISABLED
                  <div className="mt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsFiltersDialogOpen(true)}
                      className="text-[11px] px-3 py-1 theme-bg-secondary hover:theme-bg-tertiary rounded-full"
                    >
                      Filters: Apps ≥ {minApplications} • Top N {isTopNAll ? 'All' : topNResults}
                    </Button>
                  </div>
                  */}

                  {/* Input Area */}
                  <div className="space-y-2">
                    {/* Endpoint Selector */}
                    {showEndpointSelector && (
                      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <AnalysisEndpointSelector
                          selectedEndpoint={selectedEndpoint === 'auto' ? undefined : selectedEndpoint}
                          onEndpointSelect={(endpoint) => {
                            console.log('[ENDPOINT SELECTION] 🎯 Endpoint selected:', {
                              previousEndpoint: selectedEndpoint,
                              newEndpoint: endpoint,
                              timestamp: new Date().toISOString()
                            });
                            setSelectedEndpoint(endpoint);
                            setShowEndpointSelector(false);
                            
                            // Force a small delay to ensure state update, then log clustering button state
                            setTimeout(() => {
                              console.log('[ENDPOINT SELECTION] 🎯 State after endpoint selection:', {
                                selectedEndpoint: endpoint,
                                stateUpdated: true
                              });
                            }, 100);
                          }}
                          compact={true}
                          showDescription={false}
                        />
                      </div>
                    )}
                    
                    {/* Smart Endpoint Suggestions */}
                    {inputQuery && endpointSuggestions.length > 0 && !showEndpointSelector && (
                      <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <MessageCircle className="h-4 w-4 text-amber-600" />
                            <span className="text-xs text-amber-800">
                              Suggested: {endpointSuggestions[0]?.name || 'General Analysis'}
                            </span>
                          </div>
                          <div className="flex space-x-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => setShowEndpointSelector(true)}
                            >
                              Choose
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => setEndpointSuggestions([])}
                            >
                              ×
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    <Textarea
                      ref={textareaRef}
                      value={inputQuery}
                      onChange={handleInputChange}
                      onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (!isProcessing && inputQuery.trim()) {
                            analyzeButtonRef.current?.click();
                          }
                        }
                      }}
                      placeholder="Type your query here..."
                      className="w-full h-24 pr-24 font-bold resize-none text-xs"
                      disabled={isProcessing}
                    />

                    <div className="flex justify-between items-center">
                      {/* Clear Button */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="flex items-center justify-center gap-2 px-4 text-xs font-medium border border-gray-300 hover:theme-bg-tertiary hover:text-gray-700 shadow-sm hover:shadow rounded-lg h-8"
                              onClick={handleClear}
                            >
                              <X className="h-4 w-4 text-gray-500" />
                              <span>clear</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="theme-bg-primary">
                            <p>Clear all messages</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      {/* Analyze Button */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              ref={analyzeButtonRef}
                              type={isProcessing ? "button" : "submit"}
                              size="sm"
                              className={`flex items-center justify-center gap-2 px-4 rounded-lg h-8 ${
                                isProcessing 
                                  ? "bg-red-600 hover:bg-red-700 text-white" 
                                  : "bg-[#33a852] hover:bg-[#2d9748] text-white"
                              }`}
                              disabled={!inputQuery.trim() && !isProcessing}
                              onClick={isProcessing ? handleCancel : undefined}
                            >
                              {isProcessing ? (
                                <>
                                  <X className="h-4 w-4" />
                                  <span>Stop</span>
                                </>
                              ) : (
                                'Analyze'
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="theme-bg-primary">
                            <p>Analyze your query</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                </div>
              </div>
            </div> 
            </form>
            </div>
        )}

        {/* Unified Analysis Workflow - Now the default UI */}
        {inputMode === 'analysis' && showUnifiedWorkflow && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <div className="h-full overflow-hidden">
              {initialMapView && (() => {
                console.log('[GeoChat] 🔍 About to render UnifiedAnalysisWorkflow with callback:', {
                  hasInitialMapView: !!initialMapView,
                  hasHandleUnifiedAnalysisComplete: !!handleUnifiedAnalysisComplete,
                  callbackType: typeof handleUnifiedAnalysisComplete,
                  callbackName: handleUnifiedAnalysisComplete?.name
                });
                return (
                <UnifiedAnalysisWorkflow
                  view={initialMapView}
                  onAnalysisComplete={handleUnifiedAnalysisComplete}
                  enableChat={true}
                  defaultAnalysisType="query"
                  setFormattedLegendData={setFormattedLegendData}
                  onVisualizationLayerCreated={onVisualizationLayerCreated}
                />
                );
              })()}
            </div>
          </div>
        )}

        {inputMode === 'chat' && (
          <div className="min-h-[60vh] max-h-[80vh] overflow-y-auto space-y-3 px-4 py-2">
            {/* Smart Suggestions */}
            {(features.length > 0 || lastAnalysisEndpoint) && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-700">💡 Try asking:</div>
                <div className="flex flex-wrap gap-1">
                  {getSmartSuggestions().slice(0, 2).map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSubmit(suggestion, 'reply')}
                      className="text-xs px-2 py-1 bg-green-50 hover:bg-green-100 text-green-700 rounded border border-green-200 transition-colors"
                      disabled={isProcessing}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <ChatBar 
              onSend={(query) => handleSubmit(query, 'reply')} 
              placeholder={getContextualPlaceholder()}
              disabled={isProcessing}
            />
          </div>
        )}
      </div>
    </div>

    {/* Global scrollbar and animation styles */}
    <style dangerouslySetInnerHTML={{ __html: `
      * {
        scrollbar-width: thin !important;
        scrollbar-color: rgba(0,0,0,0.2) rgba(0,0,0,0.05) !important;
      }

      ::-webkit-scrollbar {
        width: 8px !important;
        background-color: rgba(0,0,0,0.05) !important;
      }

      ::-webkit-scrollbar-thumb {
        background-color: rgba(0,0,0,0.2) !important;
        border-radius: 4px !important;
      }

      ::-webkit-scrollbar-track {
        background-color: rgba(0,0,0,0.05) !important;
      }

      /* Chat nudge animation */
      .animate-fade-in {
        animation: fadeIn 0.5s ease-in-out;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .overflow-y-auto {
        overflow-y: scroll !important;
      }

      @keyframes slide-in-right {
        from {
          transform: translateX(100%);
        }
        to {
          transform: translateX(0);
        }
      }

      @keyframes slide-out-right {
        from {
          transform: translateX(0);
        }
        to {
          transform: translateX(100%);
        }
      }

      .animate-slide-in-right {
        animation: slide-in-right 0.3s ease-out;
      }

      .animate-slide-out-right {
        animation: slide-out-right 0.3s ease-in;
      }

      /* Add smooth transition for height changes */
      .transition-all {
        transition-property: all;
        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
      }

      .duration-300 {
        transition-duration: 300ms;
      }
    ` }} />

    {/* Add MessageDialog for expanded message viewing */}
    <MessageDialog 
      message={selectedMessage} 
      onClose={() => {
        setSelectedMessage(null);
        setDialogOpen(false);
      }} 
    />
    
    {/* Reply Dialog Component */}
    <Dialog open={isReplyDialogOpen} onOpenChange={setIsReplyDialogOpen}>
      <DialogContent className="max-w-lg" aria-describedby="reply-dialog-description">
        <DialogHeader>
          <DialogTitle>Reply to Assistant</DialogTitle>
          <p id="reply-dialog-description" className="text-xs text-gray-600">
            Your reply will be added to the current conversation context.
          </p>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <Textarea 
            value={replyInput}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReplyInput(e.target.value)}
            placeholder="Type your reply here..."
            className="w-full h-24 resize-none text-xs"
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (replyInput.trim()) {
                  handleSubmit(replyInput, 'reply');
                  setIsReplyDialogOpen(false);
                  setReplyInput('');
                }
              }
            }}
          />
          <div className="flex justify-end">
            <Button 
              onClick={() => {
                if (replyInput.trim()) {
                  handleSubmit(replyInput, 'reply');
                  setIsReplyDialogOpen(false);
                  setReplyInput('');
                }
              }}
              disabled={!replyInput.trim() || isProcessing}
              size="sm"
              className="bg-[#33a852] hover:bg-[#2d9748] text-white"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                'Send Reply'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Infographics Side Panel */}
    {isInfographicsOpen && (() => {
      const viewToUse = currentMapView || initialMapView;
      console.log('[GeospatialChat] InfographicsTab viewToUse:', viewToUse, 'viewToUse?.map:', viewToUse?.map, 'initialMapView:', initialMapView, 'initialMapView?.map:', initialMapView?.map, 'mapViewRefValue:', mapViewRefValue, 'mapViewRefValue?.map:', mapViewRefValue?.map);
      return (
        <div className="fixed right-0 top-0 w-[400px] h-screen theme-bg-primary shadow-lg border-l rounded-l-xl z-50 animate-slide-in-right data-[state=closed]:animate-slide-out-right">
          <div className="flex flex-col h-full">
            <div className="flex flex-row items-center justify-between px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <BarChart className="h-4 w-4 text-[#33a852]" />
                <div className="text-xs font-medium">
                  <span className="text-black">infograph</span>
                  <span className='font-bold text-[#33a852]'>IQ</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsInfographicsOpen(false)}
                className="h-6 w-6 p-0 hover:theme-bg-tertiary rounded-full mr-[50px]"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              {viewToUse && (
                <InfographicsTab
                  view={viewToUse}
                  layerStates={{}}
                  exportToPDF={() => {}}
                  showLoading={false}
                  onLayerStatesChange={() => {}}
                />
              )}
            </div>
          </div>
        </div>
      );
    })()}

    {isVizPanelOpen && activeVizMessageId && (() => {
      const activeMessage = messages.find(m => m.id === activeVizMessageId);
      const vizLayer = activeMessage?.metadata?.visualizationResult?.layer;

      if (vizLayer) {
        // The CustomVisualizationPanel expects a 'LayerConfig' object, which is not what we have.
        // The vizLayer is an esri.FeatureLayer. We create a mock config object for the panel.
        const layerConfigForPanel = {
          name: vizLayer.title || 'Analysis Layer',
          description: activeMessage?.metadata?.analysisResult?.summary || '',
          type: vizLayer.geometryType, // 'point', 'polygon', etc.
          rendererField: vizLayer.renderer?.get('field') || activeMessage?.metadata?.analysisResult?.target_variable,
          performance: { maxFeatures: 10000 },
          fields: activeMessage?.metadata?.analysisResult?.fields || []
        };

        return (
          <div className="fixed right-0 top-0 h-screen w-[30vw] theme-bg-primary shadow-lg z-50 overflow-y-auto">
            <CustomVisualizationPanel
              layer={layerConfigForPanel as any} // Casting as the panel's internal type isn't exported.
              onClose={() => setIsVizPanelOpen(false)}
              onVisualizationUpdate={(options) => {
                if (activeVizMessageId) {
                  handleVisualizationUpdate(activeVizMessageId, options);
                }
              }}
            />
          </div>
        );
      }
      return null;
    })()}

    {/* Visualization Customization Panel */}
    <Dialog open={isVizPanelOpen} onOpenChange={setIsVizPanelOpen} modal={false}>
      <DialogContent className="max-w-xl theme-bg-primary" aria-describedby="viz-panel-description">
        {/* Accessible title for screen readers */}
        <DialogHeader>
          <VisuallyHidden asChild>
            <DialogTitle>Custom Visualization</DialogTitle>
          </VisuallyHidden>
          <VisuallyHidden asChild>
            <p id="viz-panel-description">Customize visualization settings and appearance.</p>
          </VisuallyHidden>
        </DialogHeader>
        {currentLayerConfigForViz && activeVizMessageId && (
          <CustomVisualizationPanel
            layer={currentLayerConfigForViz}
            onVisualizationUpdate={(cfg) => handleVisualizationUpdate(activeVizMessageId, cfg)}
            onClose={() => setIsVizPanelOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>

    {/* SHAP Feature Importance Chart Modal */}
    <SHAPChartModal
      isOpen={shapChartOpen}
      onClose={() => setSHAPChartOpen(false)}
      data={shapChartData}
      analysisType={shapAnalysisType}
    />

    {/* Root container closing */}
    </div>
   );
 });

// Add display name for debugging and React DevTools
(EnhancedGeospatialChat as any).displayName = 'EnhancedGeospatialChat';

// Export both default and named exports for compatibility
export { EnhancedGeospatialChat };
export default EnhancedGeospatialChat; 