/**
 * Advanced Filter Dialog Component
 * 
 * Multi-tab filtering system that provides comprehensive control over analysis parameters.
 * Replaces the simple clustering dialog with a robust filtering interface.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Target,
  Home,
  Sliders, 
  Eye, 
  Zap,
  RotateCcw,
  Check,
  Info,
  AlertTriangle
} from 'lucide-react';

// Import tab components
import ClusteringTab from './tabs/ClusteringTab';
import RealEstateTab from './tabs/RealEstateTab';
import FieldFilterTab from './tabs/FieldFilterTab';
import VisualizationTab from './tabs/VisualizationTab';
import PerformanceTab from './tabs/PerformanceTab';

import { 
  AdvancedFilterDialogProps,
  FilterTabDefinition,
  FilterTabType,
  FilterSummary,
  AdvancedFilterConfig,
  DEFAULT_REAL_ESTATE_FILTER_CONFIG,
  DEFAULT_FIELD_FILTER_CONFIG,
  DEFAULT_VISUALIZATION_CONFIG,
  DEFAULT_PERFORMANCE_CONFIG
} from './types';
import { ClusterConfig, DEFAULT_CLUSTER_CONFIG } from '@/lib/clustering/types';
import { filterValidationService } from './services/FilterValidationService';
import { fieldDiscoveryService } from './services/FieldDiscoveryService';

/**
 * Calculate filter summary for UI feedback
 */
function calculateFilterSummary(config: AdvancedFilterConfig): FilterSummary {
  const fieldFilterCount = Object.values(config.fieldFilters.numericFilters).filter(f => f.enabled).length +
                          Object.values(config.fieldFilters.categoricalFilters).filter(f => f.enabled).length +
                          Object.values(config.fieldFilters.textFilters).filter(f => f.enabled).length +
                          Object.values(config.fieldFilters.nullFilters).filter(f => f.enabled).length;

  const realEstateFilterCount = Object.values(config.realEstateFilters).filter(f => f.enabled).length;

  const hasVisualizationCustomization = config.visualization.symbolSize.enabled ||
                                       config.visualization.opacity.enabled ||
                                       config.visualization.labels.enabled ||
                                       config.visualization.colorScheme !== 'viridis';

  const hasPerformanceCustomization = config.performance.sampling.enabled ||
                                     !config.performance.caching.enabled ||
                                     config.performance.timeout.enabled ||
                                     config.performance.quality.enabled;

  const activeFilters = fieldFilterCount + 
                       realEstateFilterCount +
                       (config.clustering.enabled ? 1 : 0) +
                       (hasVisualizationCustomization ? 1 : 0) +
                       (hasPerformanceCustomization ? 1 : 0);

  return {
    totalFilters: fieldFilterCount + realEstateFilterCount + 1, // +1 for clustering
    activeFilters,
    fieldFilters: fieldFilterCount,
    realEstateFilters: realEstateFilterCount,
    hasClusteringEnabled: config.clustering.enabled,
    hasVisualizationCustomization,
    hasPerformanceCustomization,
  };
}

/**
 * Tab definitions with conditional visibility
 */
function getTabDefinitions(availableFields?: any[], endpoint?: string): FilterTabDefinition[] {
  return [
    {
      id: 'clustering',
      label: 'Clustering',
      icon: Target,
      description: 'Configure spatial and statistical clustering parameters',
      enabled: true, // Always available
    },
    {
      id: 'realEstate',
      label: 'Real Estate',
      icon: Home,
      description: 'Broker-friendly property filtering (price, bedrooms, type, etc.)',
      enabled: true, // ✅ Real estate specific filters for brokers
    },
    {
      id: 'fields',
      label: 'Field Filters',
      icon: Sliders,
      description: 'Filter analysis data by field values and ranges',
      enabled: true, // ✅ Enabled in Phase 2 with field discovery
    },
    {
      id: 'visualization',
      label: 'Visualization',
      icon: Eye,
      description: 'Customize map visualization appearance',
      enabled: true, // ✅ Enabled in Phase 3 with visualization customization
    },
    {
      id: 'performance',
      label: 'Performance',
      icon: Zap,
      description: 'Advanced performance and sampling options',
      enabled: false, // Hidden for typical users - advanced optimization settings
    },
  ];
}

export default function AdvancedFilterDialog({
  open,
  onOpenChange,
  config,
  onConfigChange,
  onApply,
  onReset,
  availableFields,
  endpoint,
  className,
}: AdvancedFilterDialogProps) {
  const [activeTab, setActiveTab] = useState<FilterTabType>('clustering');
  
  // Calculate filter summary for UI feedback
  const filterSummary = useMemo(() => calculateFilterSummary(config), [config]);
  
  // Get field definitions for validation
  const fieldDefinitions = useMemo(() => {
    if (endpoint && fieldDiscoveryService.supportsEndpoint(endpoint)) {
      return fieldDiscoveryService.getFieldsForEndpoint(endpoint);
    }
    return availableFields || fieldDiscoveryService.getCommonFields();
  }, [endpoint, availableFields]);
  
  // Validate field filters
  const validation = useMemo(() => {
    return filterValidationService.validateFieldFilters(config.fieldFilters, fieldDefinitions);
  }, [config.fieldFilters, fieldDefinitions]);
  
  // Get available tabs based on current context
  const tabDefinitions = useMemo(() => getTabDefinitions(availableFields, endpoint), [availableFields, endpoint]);
  const enabledTabs = tabDefinitions.filter(tab => tab.enabled);

  // Handle configuration changes
  const handleConfigChange = useCallback((newConfig: AdvancedFilterConfig) => {
    onConfigChange(newConfig);
  }, [onConfigChange]);

  // Reset all filters to default
  const handleReset = useCallback(() => {
    const resetConfig: AdvancedFilterConfig = {
      clustering: { ...DEFAULT_CLUSTER_CONFIG },
      realEstateFilters: { ...DEFAULT_REAL_ESTATE_FILTER_CONFIG },
      fieldFilters: { ...DEFAULT_FIELD_FILTER_CONFIG },
      visualization: { ...DEFAULT_VISUALIZATION_CONFIG },
      performance: { ...DEFAULT_PERFORMANCE_CONFIG },
    };
    handleConfigChange(resetConfig);
    onReset?.();
  }, [handleConfigChange, onReset]);

  // Apply filters and close dialog
  const handleApply = useCallback(() => {
    onApply?.();
    onOpenChange(false);
  }, [onApply, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-4xl max-h-[80vh] overflow-hidden theme-dialog ${className || ''}`}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="h-5 w-5" />
              <span>Advanced Filters & Options</span>
              {filterSummary.activeFilters > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {filterSummary.activeFilters} active
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-xs"
                disabled={filterSummary.activeFilters === 0}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Separator className="flex-shrink-0" />

        <div className="flex-1 flex flex-col min-h-0">
          <Tabs 
            value={activeTab} 
            onValueChange={(value) => setActiveTab(value as FilterTabType)}
            className="flex-1 flex flex-col min-h-0"
          >
            <TabsList className="grid grid-cols-1 md:grid-cols-4 flex-shrink-0 mb-4">
              {enabledTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger 
                    key={tab.id} 
                    value={tab.id}
                    className="flex items-center gap-2 text-xs"
                  >
                    <Icon className="h-3 w-3" />
                    <span>{tab.label}</span>
                    {/* Show badge for active filters in each tab */}
                    {tab.id === 'clustering' && filterSummary.hasClusteringEnabled && (
                      <Badge variant="secondary" className="ml-1 text-xs px-1 py-0">
                        ●
                      </Badge>
                    )}
                    {tab.id === 'realEstate' && filterSummary.realEstateFilters > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs px-1 py-0">
                        {filterSummary.realEstateFilters}
                      </Badge>
                    )}
                    {tab.id === 'fields' && filterSummary.fieldFilters > 0 && (
                      <Badge variant="secondary" className="ml-1 text-xs px-1 py-0">
                        {filterSummary.fieldFilters}
                      </Badge>
                    )}
                    {tab.id === 'visualization' && filterSummary.hasVisualizationCustomization && (
                      <Badge variant="secondary" className="ml-1 text-xs px-1 py-0">
                        ●
                      </Badge>
                    )}
                    {tab.id === 'performance' && filterSummary.hasPerformanceCustomization && (
                      <Badge variant="secondary" className="ml-1 text-xs px-1 py-0">
                        ●
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* Tab Content Area */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <TabsContent value="clustering" className="mt-0 h-full">
                <ClusteringTab
                  config={config}
                  onConfigChange={handleConfigChange}
                  availableFields={availableFields}
                  endpoint={endpoint}
                />
              </TabsContent>

              <TabsContent value="realEstate" className="mt-0 h-full">
                <RealEstateTab
                  config={config}
                  onConfigChange={handleConfigChange}
                  availableFields={availableFields}
                  endpoint={endpoint}
                />
              </TabsContent>

              <TabsContent value="fields" className="mt-0 h-full">
                <FieldFilterTab
                  config={config}
                  onConfigChange={handleConfigChange}
                  availableFields={availableFields}
                  endpoint={endpoint}
                />
              </TabsContent>

              <TabsContent value="visualization" className="mt-0 h-full">
                <VisualizationTab
                  config={config}
                  onConfigChange={handleConfigChange}
                  availableFields={availableFields}
                  endpoint={endpoint}
                />
              </TabsContent>

              <TabsContent value="performance" className="mt-0 h-full">
                <PerformanceTab
                  config={config}
                  onConfigChange={handleConfigChange}
                  availableFields={availableFields}
                  endpoint={endpoint}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <Separator className="flex-shrink-0" />

        {/* Footer Actions */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {validation.errors.length > 0 ? (
              <>
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span>{validation.errors.length} error{validation.errors.length !== 1 ? 's' : ''} found</span>
              </>
            ) : validation.warnings.length > 0 ? (
              <>
                <Info className="h-4 w-4 text-yellow-500" />
                <span>{validation.warnings.length} warning{validation.warnings.length !== 1 ? 's' : ''}</span>
              </>
            ) : filterSummary.activeFilters > 0 ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                <span>{filterSummary.activeFilters} filter{filterSummary.activeFilters !== 1 ? 's' : ''} configured</span>
              </>
            ) : (
              <>
                <Info className="h-4 w-4" />
                <span>No filters active - using default settings</span>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              className="min-w-[100px]"
              disabled={validation.errors.length > 0}
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}