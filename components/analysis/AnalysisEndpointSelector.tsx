import React, { useState, useEffect } from 'react';
import { useEndpoints } from '@/hooks/useAnalysisEngine';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  BarChart3, 
  Map, 
  Users, 
  TrendingUp, 
  Zap, 
  Globe, 
  Target,
  Brain,
  Clock,
  AlertTriangle,
  Info
} from 'lucide-react';

interface AnalysisEndpointSelectorProps {
  selectedEndpoint?: string;
  onEndpointSelect: (endpoint: string) => void;
  showDescription?: boolean;
  compact?: boolean;
  showCategories?: boolean;
}

interface EndpointInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  keywords: string[];
  expectedResponseTime: number;
  icon?: React.ComponentType<any>;
  complexity: 'simple' | 'moderate' | 'advanced';
}

const CATEGORY_ICONS = {
  core: BarChart3,
  geographic: Map,
  demographic: Users,
  economic: TrendingUp,
  competitive: Target,
  temporal: Clock
};

const CATEGORY_DESCRIPTIONS = {
  core: 'Fundamental analysis operations for general insights and rankings',
  geographic: 'Spatial analysis focusing on geographic patterns and clustering',
  demographic: 'Population-based analysis of customer segments and characteristics',
  economic: 'Economic impact assessment and market risk evaluation',
  competitive: 'Brand comparison and competitive positioning analysis',
  temporal: 'Time-based analysis for trends and pattern evolution'
};

/**
 * AnalysisEndpointSelector - Advanced endpoint selection UI
 * 
 * Provides users with direct control over analysis type selection,
 * implementing the analysis-driven strategy's user-driven endpoint selection.
 */
export const AnalysisEndpointSelector: React.FC<AnalysisEndpointSelectorProps> = ({
  selectedEndpoint,
  onEndpointSelect,
  showDescription = true,
  compact = false,
  showCategories = true
}) => {
  const { endpoints, endpointsByCategory, setPreferredEndpoint } = useEndpoints();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Enhanced endpoint information with UI metadata
  const enrichEndpointInfo = (endpoint: any): EndpointInfo => {
    const complexityMap: Record<string, 'simple' | 'moderate' | 'advanced'> = {
      '/analyze': 'simple',
      '/correlation-analysis': 'simple',
      '/spatial-clusters': 'moderate',
      '/competitive-analysis': 'moderate',
      '/demographic-insights': 'moderate',
      '/market-risk': 'advanced',
      '/trend-analysis': 'advanced'
    };

    return {
      ...endpoint,
      icon: CATEGORY_ICONS[endpoint.category as keyof typeof CATEGORY_ICONS] || Brain,
      complexity: complexityMap[endpoint.id] || 'moderate'
    };
  };

  // Filter endpoints based on category and search
  const filteredEndpoints = endpoints
    .map(enrichEndpointInfo)
    .filter(endpoint => {
      const categoryMatch = selectedCategory === 'all' || endpoint.category === selectedCategory;
      const searchMatch = searchTerm === '' || 
        endpoint.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        endpoint.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        endpoint.keywords.some(keyword => keyword.toLowerCase().includes(searchTerm.toLowerCase()));
      
      return categoryMatch && searchMatch;
    });

  const handleEndpointSelect = (endpointId: string) => {
    setPreferredEndpoint(endpointId);
    onEndpointSelect(endpointId);
  };

  // Get complexity color
  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'simple': return 'bg-green-100 text-green-800';
      case 'moderate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get response time color
  const getResponseTimeColor = (time: number) => {
    if (time < 10000) return 'text-green-600';
    if (time < 20000) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (compact) {
    return (
      <div className="space-y-2">
        <Select value={selectedEndpoint} onValueChange={handleEndpointSelect}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select analysis type..." />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(endpointsByCategory).map(([category, categoryEndpoints]) => (
              <div key={category}>
                <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {category}
                </div>
                {categoryEndpoints.map((endpoint: any) => {
                  const enriched = enrichEndpointInfo(endpoint);
                  const IconComponent = enriched.icon!;
                  return (
                    <SelectItem key={endpoint.id} value={endpoint.id}>
                      <div className="flex items-center space-x-2">
                        <IconComponent className="h-4 w-4" />
                        <span>{endpoint.name}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Analysis Type Selection</h3>
          <p className="text-sm text-gray-600">
            Choose the specific analysis endpoint for your query
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm">
                <Info className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Direct endpoint selection provides more reliable and predictable results</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Search and Filter */}
      <div className="flex space-x-2">
        <input
          type="text"
          placeholder="Search endpoints..."
          value={searchTerm}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {showCategories && (
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.keys(endpointsByCategory).map(category => (
                <SelectItem key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Category Overview */}
      {showCategories && selectedCategory !== 'all' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              {React.createElement(CATEGORY_ICONS[selectedCategory as keyof typeof CATEGORY_ICONS] || Brain, 
                { className: "h-5 w-5" })}
              <span>{selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Analysis</span>
            </CardTitle>
            <CardDescription>
              {CATEGORY_DESCRIPTIONS[selectedCategory as keyof typeof CATEGORY_DESCRIPTIONS]}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Endpoint Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEndpoints.map((endpoint) => {
          const isSelected = selectedEndpoint === endpoint.id;
          const IconComponent = endpoint.icon!;
          
          return (
            <Card 
              key={endpoint.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : ''
              }`}
              onClick={() => handleEndpointSelect(endpoint.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <IconComponent className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-sm">{endpoint.name}</CardTitle>
                  </div>
                  <div className="flex space-x-1">
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${getComplexityColor(endpoint.complexity)}`}
                    >
                      {endpoint.complexity}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {showDescription && (
                  <p className="text-xs text-gray-600 mb-3">{endpoint.description}</p>
                )}
                
                <div className="space-y-2">
                  {/* Response Time */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Response Time:</span>
                    <span className={getResponseTimeColor(endpoint.expectedResponseTime)}>
                      ~{Math.round(endpoint.expectedResponseTime / 1000)}s
                    </span>
                  </div>
                  
                  {/* Keywords */}
                  <div className="flex flex-wrap gap-1">
                    {endpoint.keywords.slice(0, 3).map(keyword => (
                      <Badge key={keyword} variant="outline" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                    {endpoint.keywords.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{endpoint.keywords.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Selection Summary */}
      {selectedEndpoint && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-4">
            <div className="flex items-center space-x-2 text-green-800">
              <Target className="h-4 w-4" />
              <span className="font-medium">
                Selected: {filteredEndpoints.find(e => e.id === selectedEndpoint)?.name}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results */}
      {filteredEndpoints.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <AlertTriangle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">No endpoints match your search criteria</p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
              }}
            >
              Clear Filters
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AnalysisEndpointSelector; 