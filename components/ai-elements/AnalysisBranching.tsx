'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Branch, BranchMessages, BranchSelector } from './branch';
import { Actions, Action } from './actions';
import { Loader } from './loader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  MapPin, 
  Target, 
  Zap,
  ChevronRight,
  RefreshCw
} from 'lucide-react';

// Types for analysis branching
interface AnalysisEndpoint {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  confidence?: number;
  compatibility?: number;
}

interface AnalysisBranchingProps {
  selectedAreaName?: string;
  currentQuery?: string;
  onBranchSelect?: (endpoint: string, query: string) => void;
  onAnalysisRun?: (endpoint: string, query: string) => void;
  className?: string;
  persona?: string;
  mapContext?: {
    selectedZipCodes?: string[];
    selectedAreaName?: string;
    bounds?: any;
  };
}

// Predefined endpoint configurations that match the existing analysis system
const ANALYSIS_ENDPOINTS: AnalysisEndpoint[] = [
  {
    id: 'strategic-analysis',
    name: 'Strategic Analysis',
    description: 'Market expansion potential and strategic insights',
    icon: Target,
    confidence: 0.92,
    compatibility: 0.95
  },
  {
    id: 'demographic-analysis', 
    name: 'Demographic Analysis',
    description: 'Population characteristics and target segments',
    icon: Users,
    confidence: 0.88,
    compatibility: 0.90
  },
  {
    id: 'competitive-analysis',
    name: 'Competitive Analysis',
    description: 'Market gaps and competitive landscape',
    icon: BarChart3,
    confidence: 0.85,
    compatibility: 0.88
  },
  {
    id: 'trend-analysis',
    name: 'Trend Analysis', 
    description: 'Growth patterns and future projections',
    icon: TrendingUp,
    confidence: 0.82,
    compatibility: 0.85
  },
  {
    id: 'location-analysis',
    name: 'Location Analysis',
    description: 'Geographic and spatial market analysis',
    icon: MapPin,
    confidence: 0.90,
    compatibility: 0.93
  },
  {
    id: 'predictive-modeling',
    name: 'Predictive Modeling',
    description: 'AI-powered forecasting and predictions',
    icon: Zap,
    confidence: 0.87,
    compatibility: 0.82
  }
];

export const AnalysisBranching: React.FC<AnalysisBranchingProps> = ({
  selectedAreaName = 'Selected Area',
  currentQuery = '',
  onBranchSelect,
  onAnalysisRun,
  className,
  persona = 'strategist',
  mapContext
}) => {
  const [selectedBranch, setSelectedBranch] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [branchMessages, setBranchMessages] = useState<Array<{
    endpoint: string;
    query: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    confidence: number;
  }>>([]);

  // Generate context-aware analysis suggestions based on current state
  const generateBranchingSuggestions = useCallback(async () => {
    setIsGenerating(true);
    
    // Simulate intelligent endpoint suggestion based on query and map context
    try {
      const contextualEndpoints = ANALYSIS_ENDPOINTS.slice(0, 3).map((endpoint, index) => {
        const areaName = mapContext?.selectedAreaName || selectedAreaName;
        const zipCount = mapContext?.selectedZipCodes?.length || 0;
        const contextSuffix = zipCount > 0 ? ` across ${zipCount} ZIP codes` : '';
        
        // Generate contextual queries for each endpoint
        const contextualQuery = generateContextualQuery(endpoint.id, areaName, currentQuery);
        
        return {
          endpoint: endpoint.id,
          query: contextualQuery,
          description: `${endpoint.description}${contextSuffix}`,
          icon: endpoint.icon,
          confidence: endpoint.confidence || 0.8 + (Math.random() * 0.15) // Add some variation
        };
      });

      // Sort by confidence and compatibility with current context
      contextualEndpoints.sort((a, b) => b.confidence - a.confidence);
      
      setBranchMessages(contextualEndpoints);
    } catch (error) {
      console.error('Error generating branching suggestions:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [selectedAreaName, currentQuery, mapContext]);

  // Persona-aware query generation
  const getPersonaContext = (persona: string) => {
    const personaContexts: Record<string, Record<string, string>> = {
      'strategist': {
        'strategic-analysis': 'Strategic market expansion opportunities and investment potential',
        'demographic-analysis': 'Target market segmentation and strategic customer profiles',
        'competitive-analysis': 'Competitive positioning and strategic market advantages',
        'trend-analysis': 'Strategic trend analysis and future growth opportunities',
        'location-analysis': 'Strategic location advantages and expansion planning',
        'predictive-modeling': 'Strategic forecasting and market opportunity predictions'
      },
      'analyst': {
        'strategic-analysis': 'Comprehensive market performance analysis and metrics',
        'demographic-analysis': 'Statistical demographic analysis and data patterns',
        'competitive-analysis': 'Quantitative competitive analysis and market share data',
        'trend-analysis': 'Time-series analysis and trend pattern identification',
        'location-analysis': 'Geographic data analysis and spatial patterns',
        'predictive-modeling': 'Statistical modeling and predictive analytics'
      },
      'consultant': {
        'strategic-analysis': 'Business consulting recommendations and actionable insights',
        'demographic-analysis': 'Customer segmentation recommendations and target strategies',
        'competitive-analysis': 'Competitive strategy recommendations and positioning advice',
        'trend-analysis': 'Trend-based business recommendations and market timing',
        'location-analysis': 'Location strategy consulting and site recommendations',
        'predictive-modeling': 'Business forecasting and strategic planning recommendations'
      }
    };

    return personaContexts[persona] || personaContexts['strategist'];
  };

  // Generate contextual query for each endpoint type with persona awareness
  const generateContextualQuery = (endpointId: string, areaName: string, baseQuery: string): string => {
    const personaQueries = getPersonaContext(persona);
    const baseQueryTemplate = personaQueries[endpointId] || `Analysis of ${endpointId.replace(/-/g, ' ')}`;
    
    // Use base query context if available
    if (baseQuery.trim()) {
      const contextualPrefix = baseQueryTemplate.split(' ')[0] || 'Analysis';
      return `${contextualPrefix}: ${baseQuery} in ${areaName}`;
    }
    
    return `${baseQueryTemplate} for ${areaName}`;
  };

  // Auto-generate suggestions when component mounts or context changes
  useEffect(() => {
    if (selectedAreaName || currentQuery || mapContext) {
      generateBranchingSuggestions();
    }
  }, [generateBranchingSuggestions]);

  const handleBranchSelect = useCallback((index: number) => {
    setSelectedBranch(index);
    const selectedBranchData = branchMessages[index];
    if (selectedBranchData && onBranchSelect) {
      onBranchSelect(selectedBranchData.endpoint, selectedBranchData.query);
    }
  }, [branchMessages, onBranchSelect]);

  const handleRunAnalysis = useCallback(() => {
    const selectedBranchData = branchMessages[selectedBranch];
    if (selectedBranchData && onAnalysisRun) {
      onAnalysisRun(selectedBranchData.endpoint, selectedBranchData.query);
    }
  }, [branchMessages, selectedBranch, onAnalysisRun]);

  const handleRegenerateOptions = useCallback(() => {
    generateBranchingSuggestions();
  }, [generateBranchingSuggestions]);

  if (isGenerating) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex items-center gap-2">
          <Loader className="w-4 h-4" />
          <span className="text-sm text-muted-foreground">
            Generating analysis options for {selectedAreaName}...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Analysis Options</h3>
          <p className="text-xs text-muted-foreground">
            Choose an analysis type for {selectedAreaName}
          </p>
        </div>
        <Actions>
          <Action
            tooltip="Regenerate analysis options"
            onClick={handleRegenerateOptions}
          >
            <RefreshCw className="w-3 h-3" />
          </Action>
        </Actions>
      </div>

      {/* Branch Component */}
      {branchMessages.length > 0 && (
        <Branch 
          defaultBranch={selectedBranch}
          onBranchChange={handleBranchSelect}
          className="border rounded-lg"
        >
          <BranchMessages className="space-y-2 p-3">
            {branchMessages.map((branch, index) => {
              const IconComponent = branch.icon;
              return (
                <div 
                  key={branch.endpoint}
                  onClick={() => handleBranchSelect(index)}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-md transition-colors",
                    "hover:bg-muted/50 cursor-pointer border",
                    index === selectedBranch 
                      ? "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800" 
                      : "border-border"
                  )}
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
                    <IconComponent className="w-4 h-4" />
                  </div>
                  
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{branch.endpoint.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                      <Badge variant="secondary" className="text-xs">
                        {Math.round(branch.confidence * 100)}% match
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-muted-foreground">
                      {branch.description}
                    </p>
                    
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono bg-muted px-2 py-1 rounded">
                        {branch.query}
                      </span>
                    </div>
                  </div>

                  <ChevronRight className={cn(
                    "w-4 h-4 transition-transform",
                    index === selectedBranch ? "rotate-90" : ""
                  )} />
                </div>
              );
            })}
          </BranchMessages>

          <BranchSelector from="assistant" className="flex justify-between items-center p-3 border-t bg-muted/20">
            <div className="text-xs text-muted-foreground">
              Option {selectedBranch + 1} of {branchMessages.length}
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleRegenerateOptions}
                className="text-xs h-8 px-3"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                More Options
              </Button>
              
              <Button 
                size="sm" 
                onClick={handleRunAnalysis}
                className="text-xs h-8 px-3"
              >
                Run Analysis
                <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          </BranchSelector>
        </Branch>
      )}

      {/* No options state */}
      {branchMessages.length === 0 && !isGenerating && (
        <div className="text-center py-8 text-muted-foreground">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">No analysis options available</p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={generateBranchingSuggestions}
            className="mt-2"
          >
            Generate Options
          </Button>
        </div>
      )}
    </div>
  );
};

export default AnalysisBranching;